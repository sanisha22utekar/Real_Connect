import asyncio
import json
import os
from pathlib import Path

from aiohttp import WSMsgType, web

PUBLIC = Path(__file__).with_name("public")
CLIENTS = web.AppKey("clients", set)


async def index(request):
    return web.FileResponse(PUBLIC / "index.html")


async def send_to_client(client, payload):
    try:
        await asyncio.wait_for(client.send_json(payload), timeout=3)
    except (ConnectionError, RuntimeError, TimeoutError):
        await client.close(drain=False)


async def chat_socket(request):
    socket = web.WebSocketResponse(heartbeat=25, max_msg_size=16_384)
    await socket.prepare(request)
    clients = request.app[CLIENTS]
    clients.add(socket)
    try:
        async for frame in socket:
            if frame.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(frame.data)
            except ValueError:
                continue
            if not isinstance(data, dict) or data.get("action") != "sendMessage":
                continue
            sender = data.get("sender")
            message = data.get("message")
            if not isinstance(sender, str) or not isinstance(message, str):
                continue
            sender, message = sender.strip(), message.strip()
            if not (0 < len(sender) <= 80 and 0 < len(message) <= 2000):
                continue

            await asyncio.gather(*(
                send_to_client(client, {
                    "sender": sender,
                    "message": message,
                    "own": client is socket,
                })
                for client in tuple(clients) if not client.closed
            ))
    finally:
        clients.discard(socket)
    return socket


async def close_clients(app):
    await asyncio.gather(*(client.close(code=1001) for client in tuple(app[CLIENTS])))


app = web.Application()
app[CLIENTS] = set()
app.router.add_get("/", index)
app.router.add_get("/ws", chat_socket)
app.router.add_static("/", PUBLIC)
app.on_shutdown.append(close_clients)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
