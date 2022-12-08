// Doc OpenAI: https://beta.openai.com/docs/introduction

const fetch = require('node-fetch');
const bots = require('../../libs/bots.js');
//const onNewMessage = require('./onNewMessage');
const BOT_NAME = "gpt";
const AVATAR = {
	src:'url',
	key:'https://miaou.dystroy.org/file-host/452a16a6a8c105fd33cb696c.png'
};

const INTRO = "gpt is a helpful and polite bot living in the Miaou chat server, a server created by @dystroy:\n";
const MAX_CONVERSATION_LENGTH = 50;
const conversations = new Map; // roomId -> {[messages]}
let bot;
let API_KEY;
exports.name = "miaou.gpt";

exports.init = async function(miaou){
	console.log("CONF:", miaou.conf("pluginConfig", "miaou.gpt"));
	API_KEY = miaou.conf("pluginConfig", "miaou.gpt", "api", "key");
	console.log('API_KEY:', API_KEY);
	if (!API_KEY) {
		console.error("Missing API KEY for GPT bot");
		return;
	}
	let db = miaou.db;
	db.on(BOT_NAME)
	.then(db.getBot)
	.then(function(dbbot){
		bot = dbbot;
		if (bot.avatarsrc!=AVATAR.src || bot.avatarkey!=AVATAR.key) {
			bot.avatarsrc = AVATAR.src;
			bot.avatarkey = AVATAR.key;
			return this.updateUser(bot);
		}
	})
	.then(function(){
		bots.register(bot, { onPing });
	})
	.finally(db.off);
}

function messagesToPrompt(messages){
	return [
		`${BOT_NAME}: ${INTRO}`,
		...messages.map(m => `${m.authorname}: ${m.content}`),
		`${BOT_NAME}: `
	].join("\n");
}

async function onPing(shoe, m){
	if (!m.id||!m.content) return;
	let match = m.content.match(/^@gpt(?:#\d+)? ([\s\S]*)$/im);
	if (!match) return; // happens if the ping isn't at the start
	m = {
		id: m.id,
		authorname: m.authorname,
		content: match[1]
	};
	let conv = conversations.get(m.room);
	if (!conv || m.content.trim()=="reset") {
		conv = { messages: [] };
		conversations.set(m.room, conv);
	}
	conv.messages = conv.messages.slice(-MAX_CONVERSATION_LENGTH);
	conv.messages.push(m);
	let prompt = messagesToPrompt(conv.messages);
	console.log('prompt:', prompt);
	const response = await fetch("https://api.openai.com/v1/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${API_KEY}`,
		},
		body: JSON.stringify({
			model: "text-davinci-003",
			max_tokens: 800,
			prompt
		})
	});
    const data = await response.json();
	console.log('data:', data);
	if (data.choices && data.choices.length) {
		let content = data.choices[0].text;
		conv.messages.push({authorname: BOT_NAME, content });
		shoe.botMessage(bot, `@${m.authorname} ${content}`);
		if (data.usage && data.usage.total_tokens>3000 && conv.messages.length) {
			console.log("cropping conversation");
			conv.messages.splice(0, 3);
		}
	} else {
		console.error("no valid answer in", data);
	}
}

