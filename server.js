const http = require('http');
const Koa = require('koa');
const cors = require('koajs-cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const faker = require('faker');

const serve = require('koa-static');

const ws = require('ws');
const Router = require('koa-router');
const router = new Router();

const koaBody = require('koa-body');

const formidable = require('formidable');

const port = process.env.PORT || 7070;

const app = new Koa();

app.use(serve('.'));

app.use(cors({
    origin: true
}));

app.use(koaBody({
    urlencoded: true,
    multipart: true,
}));

const serverLink = `http://localhost:${port}`;

const server = http.createServer(app.callback());
const wsServer = new ws.Server({ server });

let clients = new Map();
let messages = [];

// fake messages
class Message {
    constructor(type = contentTypes.TEXT, message, author, name = null) {
        this.type = type;
        this.message = message;
        this.author = author;
        this.name = name;
        this.id = uuidv4();
        this.timestamp = Date.now();
    }
}

const contentTypes = {
    TEXT: 'text',
    AUDIO: 'audio',
    VIDEO: 'video',
    IMG: 'img',
};

messages = Array(50).fill(null).map(() => {
    return new Message(contentTypes.TEXT, faker.random.words(), uuidv4())
})
//

const processNewMessage = (newMessage) => {
    newMessage.timestamp = Date.now();
    messages.push(newMessage)

    Array.from(clients.keys()).forEach((key) => {
        const client = clients.get(key)
        client.send(JSON.stringify({newMessage}))
    })
}

wsServer.on('connection', (ws) => {
    const id = uuidv4();
    clients.set(id, ws);
    ws.on('close', () => {
        clients.delete(id);
    })
})

router.get('/posts/latest', async (ctx, next) => {
    ctx.response.body = messages.slice(-10);
})

router.get('/posts/all', async (ctx, next) => {
    ctx.response.body = messages;
})

router.get('/posts/:id', async (ctx, next) => {
    const id = ctx.params.id;

    if (id) {
        const index = messages.findIndex(item => item.id === id);

        if(index) {
            let begin = index - 10;
            if(begin < 0) {
                begin = 0;
            }

            ctx.response.body = messages.slice(begin, index + 1);
        }
    }
})

const botData = {
    dating: [
        'Одинокая девушка мечтает познакомиться',
        'Встретимся на опушке леса',
        "Серый волк ждет свою Красную шапочку",
        'Секса хочется'
    ],
    joke: [
        'Где эта тончайшая грань между голой женщиной и искусством?',
        'Если перестать вывозить мусор, то никто уже не будет обращать внимания, что снег не убран.',
        'Если ты ищешь, чем бы заняться, то на самом деле занятие у тебя уже есть.'
    ],
    aphorism: [
        'Плата за индивидуальность — одиночество.',
        'Берегите в себе человека.',
        'Навсегда ничего не бывает.',
    ],
    weather: [
        'В Москве опять хорошая погода',
        'На Брайтон бич опять идут дожди',
        'Нижнее Гадюкино затопило дождем'
    ],
    news: [
        'Путин бла-бла-бла',
        'Байдон бла-бла-бла',
        'А что там внаукраине'
    ],
    help: [
        'Доступны следующие команды: [@chaos:] dating - знакомства; joke - шутки; aphorism- афоризмы; weather - погода; news - новости',
    ]
}

router.post('/message', async (ctx, next) => {
    const message = ctx.request.body;

    if (message.message.includes('@chaos')) {
        const command = message.message.replace('@chaos:', '').trim();

        const answers = botData[command];
        let answer;
        if (answers) {
            answer = `@chaos: ${command} - ${answers.sort(() => (Math.random() > .5) ? 1 : -1)[0]}`;
        } else {
            answer = `@chaos: help - ${botData.help[0]}`;
        }

        ctx.response.body = new Message(contentTypes.TEXT, answer, '@chaos');
    } else {
        const files = ctx.request.files;
        if (files && files.file) {
            let {path, name, type} = ctx.request.files.file
            try {
                name = name.replace(/\s/g, '');
                fs.copyFileSync(path, `./files/${name}`);
                message.name = name;
                message.mimeType = type;
                processNewMessage(message);
                ctx.response.body = '';
            } catch (err) {
                throw err
            }
        } else {
            processNewMessage(message);
            ctx.response.body = '';
        }
    }
})

app.use(router.routes());
app.use(router.allowedMethods());

server.listen(port);
