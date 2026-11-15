const facts = ['WebSockets deliver messages in real time.', 'Two browser tabs can join the same chat.', 'This chat runs on Render.'];
const fact = document.getElementById('fact');
let factIndex = 0;
fact.textContent = facts[factIndex];
setInterval(() => {
    factIndex = (factIndex + 1) % facts.length;
    fact.textContent = facts[factIndex];
}, 3000);

const status = document.getElementById('status');
const chat = document.getElementById('chat');
const sender = document.getElementById('sender');
const message = document.getElementById('msg');
const send = document.getElementById('send');
sender.maxLength = 80;
message.maxLength = 2000;

function add(name, body, ownMessage) {
    const row = document.createElement('div');
    row.className = ownMessage ? 'row me' : 'row';
    const label = document.createElement('small');
    label.textContent = name;
    const bubble = document.createElement('span');
    bubble.className = 'bubble';
    bubble.textContent = body;
    row.append(label, document.createElement('br'), bubble);
    chat.append(row);
    chat.scrollTop = chat.scrollHeight;
}

let socket;
function connect() {
    const endpoint = new URL('/ws', window.location.href);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    status.textContent = 'Connecting…';
    send.disabled = true;
    socket = new WebSocket(endpoint);
    socket.onopen = () => {
        status.textContent = '🟢 Connected';
        send.disabled = false;
    };
    socket.onclose = () => {
        status.textContent = '🔴 Disconnected';
        send.disabled = true;
        setTimeout(connect, 3000);
    };
    socket.onmessage = ({ data }) => {
        const incoming = JSON.parse(data);
        add(incoming.sender, incoming.message, incoming.own);
    };
}

send.onclick = () => {
    const name = sender.value.trim();
    const body = message.value.trim();
    if (!name || !body || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ action: 'sendMessage', sender: name, message: body }));
    message.value = '';
};
message.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send.click();
    }
});
connect();
