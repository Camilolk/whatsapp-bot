const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto, jidDecode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// =========================
// ⚔ CONFIG HECHIZO
// =========================

const PREFIX = '!';

const OWNERS = new Set([
    '573004279762',
    '573117415491',
    '5491128539362',
    '45062830428357',
    '127419231023296',
    '212970869133436'
]);

const RANGOS = [
    'durmiente',
    'despierto',
    'maestro',
    'santo',
    'supremo',
    'sagrado',
    'divino'
];

// =========================
// SISTEMA DE XP Y RANGOS
// =========================

const XP_CONFIG = {
    durmiente: { xpRequerida: 1500, xpPorMensaje: 5, multiplicador: 1 },
    despierto: { xpRequerida: 5000, xpPorMensaje: 4, multiplicador: 1.2 },
    maestro: { xpRequerida: 15000, xpPorMensaje: 3, multiplicador: 1.5 },
    santo: { xpRequerida: 50000, xpPorMensaje: 2, multiplicador: 2.5 },
    supremo: { xpRequerida: 150000, xpPorMensaje: 1, multiplicador: 4 },
    sagrado: { xpRequerida: 300000, xpPorMensaje: 1, multiplicador: 5 },
    divino: { xpRequerida: 1000000, xpPorMensaje: 1, multiplicador: 5 }
};

// =========================
// COOLDOWNS
// =========================

const COOLDOWNS = {};

function verificarCooldown(userId, comando, minutos) {
    const key = `${userId}_${comando}`;
    const ahora = Date.now();
    
    if (COOLDOWNS[key] && ahora - COOLDOWNS[key] < minutos * 60000) {
        const tiempoRestante = Math.ceil((COOLDOWNS[key] + minutos * 60000 - ahora) / 60000);
        return { activo: true, tiempoRestante };
    }
    
    COOLDOWNS[key] = ahora;
    return { activo: false, tiempoRestante: 0 };
}

// =========================
// MEMORIA CON GUARDADO
// =========================

const DATA_FILE = path.join(__dirname, 'usuarios.json');

function cargarUsuarios() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const usuariosData = JSON.parse(data);
            
            for (let key in usuariosData) {
                if (usuariosData[key].xp === undefined) usuariosData[key].xp = 0;
                if (usuariosData[key].nucleo === undefined) usuariosData[key].nucleo = 'apagado';
            }
            
            return usuariosData;
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            return {};
        }
    }
    return {};
}

let saveInterval = null;
let needsSave = false;

function marcarParaGuardar() {
    needsSave = true;
}

function guardarUsuarios() {
    if (!needsSave) return;
    
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usuarios, null, 2), 'utf8');
        needsSave = false;
        console.log('💾 Datos guardados');
    } catch (error) {
        console.error('Error guardando usuarios:', error);
    }
}

const usuarios = cargarUsuarios();

// =========================
// UTILIDAD: EXTRAE ID LIMPIA
// =========================

function extractUserId(jid) {
    if (!jid) return null;
    return jid.split('@')[0];
}

// =========================
// UTILIDAD: Obtiene menciones correctamente
// =========================

function getMentionedUsers(message) {
    const mentions = [];
    
    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        message.message.extendedTextMessage.contextInfo.mentionedJid.forEach(jid => {
            mentions.push(extractUserId(jid));
        });
    }
    
    return mentions;
}

// =========================
// FUNCIÓN: Calcular puntuación de rango
// =========================

function calcularPuntuacionRango(rango, xp) {
    const rangoIndex = RANGOS.indexOf(rango);
    return (rangoIndex * 1000000) + xp;
}

// =========================
// FUNCIÓN: Añadir XP
// =========================

function añadirXP(userId, cantidad) {
    if (!usuarios[userId]) usuarios[userId] = createUser();
    
    const user = usuarios[userId];
    if (user.xp === undefined) user.xp = 0;
    
    const rangoActual = user.rango;
    const config = XP_CONFIG[rangoActual];
    
    const xpGanada = Math.floor(cantidad * config.multiplicador);
    const xpFinal = user.rango === 'divino' ? xpGanada * 3 : xpGanada;
    user.xp += xpFinal;
    
    const rangoIndex = RANGOS.indexOf(rangoActual);
    
    if (rangoIndex < RANGOS.length - 1 && user.xp >= config.xpRequerida) {
        const nuevoRango = RANGOS[rangoIndex + 1];
        user.rango = nuevoRango;
        user.xp = 0;
        marcarParaGuardar();
        
        return {
            subioDe: true,
            rangoAnterior: rangoActual,
            rangoNuevo: nuevoRango,
            xpGanada: xpFinal
        };
    }
    
    marcarParaGuardar();
    return {
        subioDe: false,
        xpGanada: xpFinal,
        xpActual: user.xp,
        xpRequerida: config.xpRequerida
    };
}

// =========================
// FUNCIÓN: Añadir XP directo
// =========================

function añadirXPDirecto(userId, cantidad) {
    if (!usuarios[userId]) usuarios[userId] = createUser();
    
    const user = usuarios[userId];
    if (user.xp === undefined) user.xp = 0;
    
    const ascensos = [];
    user.xp += cantidad;
    
    while (true) {
        const rangoIndex = RANGOS.indexOf(user.rango);
        if (rangoIndex >= RANGOS.length - 1) break;
        
        const config = XP_CONFIG[user.rango];
        if (user.xp >= config.xpRequerida) {
            const anterior = user.rango;
            user.rango = RANGOS[rangoIndex + 1];
            user.xp -= config.xpRequerida;
            ascensos.push({ anterior, nuevo: user.rango });
        } else {
            break;
        }
    }
    
    while (user.xp < 0 && RANGOS.indexOf(user.rango) > 0) {
        const rangoIndex = RANGOS.indexOf(user.rango);
        const rangoAnterior = RANGOS[rangoIndex - 1];
        const configAnterior = XP_CONFIG[rangoAnterior];
        
        user.xp += configAnterior.xpRequerida;
        user.rango = rangoAnterior;
    }
    
    if (user.xp < 0) user.xp = 0;
    marcarParaGuardar();
    
    return { ascensos, rangoFinal: user.rango, xpFinal: user.xp };
}

// =========================
// UTILIDAD: parsea "nombre" "descripcion"
// =========================

function parseNombreDesc(args) {
    const regex = /["'](.+?)["']\s*["'](.+?)["']/;
    const match = args.match(regex);
    if (match) return { nombre: match[1].trim(), desc: match[2].trim() };

    const single = args.match(/["'](.+?)["']/);
    if (single) return { nombre: single[1].trim(), desc: null };

    return { nombre: args.trim(), desc: null };
}

// =========================
// CREAR BARRA DE XP
// =========================

function crearBarra(porcentaje) {
    const largo = 20;
    const lleno = Math.round((porcentaje / 100) * largo);
    const vacio = largo - lleno;
    
    const barra = '█'.repeat(lleno) + '░'.repeat(vacio);
    return `[${barra}] ${porcentaje}%`;
}

// =========================
// FORMATO SOLO NOMBRES
// =========================

function formatSoloNombres(lista) {
    if (!lista.length) return '       — vacío —';
    return lista.map(item => `  ▪ ${item.nombre}`).join('\n');
}

function format(u) {
    const xpActual = u.xp || 0;
    const xpRequerida = XP_CONFIG[u.rango].xpRequerida;
    
    return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
       🔮 H E C H I Z O 🔮
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 INFORMACIÓN BÁSICA
───────────────────────
👤 Nombre   ▸ ${u.nombre}
⭐ Rango    ▸ ${u.rango}
💫 Núcleo   ▸ ${u.nucleo}

📊 EXPERIENCIA
───────────────────────
XP: ${xpActual}/${xpRequerida}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

◈ ${u.nombreVerdadero} ◈

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 RECUERDOS
───────────────────────
${formatSoloNombres(u.recuerdos)}

🌊 ECOS
───────────────────────
${formatSoloNombres(u.ecos)}

✨ ATRIBUTOS
───────────────────────
${formatSoloNombres(u.atributos)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
}

function formatDetalle(titulo, lista) {
    if (!lista.length) {
        return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ${titulo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

       — vacío —

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
    }

    const items = lista.map(item => {
        return item.desc
            ? `▪ ${item.nombre}\n   └─ ${item.desc}`
            : `▪ ${item.nombre}\n   └─ Sin descripción.`;
    }).join('\n\n');

    return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ${titulo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${items}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
}

// =========================
// MODELO
// =========================

function createUser() {
    return {
        nombre: '…',
        nombreVerdadero: '???',
        descVerdadero: null,
        rango: 'durmiente',
        nucleo: 'apagado',
        xp: 0,
        recuerdos: [],
        ecos: [],
        atributos: []
    };
}

// =========================
// INICIAR BOT
// =========================

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log(`
🔮══════════════════════🔮
   HECHIZO ESTABLE
   RUNAS ACTIVAS
   MODO OPTIMIZADO ⚡
🔮══════════════════════🔮
            `);
            if (!saveInterval) {
                saveInterval = setInterval(guardarUsuarios, 120000);
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Desconectado, reintentando...');
            if (shouldReconnect) {
                setTimeout(() => start(), 3000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const message = m.messages[0];
            if (!message.message) return;
            if (message.key.fromMe) return;

            const rawFrom = message.key.remoteJid;
            const userId = extractUserId(message.key.participant || rawFrom);
            const isGroup = rawFrom.includes('@g.us');
            
            if (!userId) return;

            const isOwner = OWNERS.has(userId);
            let isAdmin = false;
            
            // Detectar admin del grupo
            if (isGroup) {
                try {
                    const groupMetadata = await sock.groupMetadata(rawFrom);
                    const participant = groupMetadata.participants.find(p => extractUserId(p.id) === userId);
                    if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                        isAdmin = true;
                    }
                } catch (error) {
                    //
                }
            }
            
            const canUseAdminCmds = isOwner || isAdmin;
            
            if (!usuarios[userId]) usuarios[userId] = createUser();
            const user = usuarios[userId];

            let body = '';
            if (message.message.conversation) body = message.message.conversation;
            else if (message.message.extendedTextMessage?.text) body = message.message.extendedTextMessage.text;
            
            body = body.trim();
            
            // =========================
            // SISTEMA DE XP
            // =========================
            
            if (!body.startsWith(PREFIX) && body.length > 0) {
                const resultadoXP = añadirXP(userId, XP_CONFIG[user.rango].xpPorMensaje);
                
                if (resultadoXP.subioDe) {
                    const nombre = user.nombre;
                    
                    await sock.sendMessage(rawFrom, {
                        text: `🎆 ¡ASCENSO! 🎆\n\n${nombre} ha ascendido de rango\n\n${resultadoXP.rangoAnterior.toUpperCase()} → ${resultadoXP.rangoNuevo.toUpperCase()}\n\n⭐ ¡Felicidades! ⭐`
                    });
                }
                
                return;
            }

            if (!body.startsWith(PREFIX)) return;

            const [cmdRaw, ...argsArr] = body.slice(PREFIX.length).split(' ');
            const cmd = cmdRaw.toLowerCase();
            const args = argsArr.join(' ').trim();

            // =========================
            // DEBUG ID
            // =========================

            if (cmd === 'miid') {
                return sock.sendMessage(rawFrom, {
                    text: `🔮 Tu Hechizo ID:\n${userId}\n\nNombre: ${user.nombre}\nIs Owner: ${isOwner}\nIs Admin: ${isAdmin}`
                });
            }

            // =========================
            // HELP
            // =========================

            if (cmd === 'help' && args === '') {
                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
        🔮 R U N A S 🔮
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 COMANDOS DE CONSULTA
!runas, !nivel, !top, !miid

📜 VER DETALLES
!vernombre, !veratributos, !verrecuerdos, !verecos

👤 PARA TODOS
!setnombre <name>

⚙️ ADMIN/OWNER
!setrango @user <rango>
!setnucleo @user <nucleo>
!setverdadero <nombre>
!xp @user <cantidad>
!reset

📌 SOLO OWNER
!resetall

🎯 RANGOS
${RANGOS.map((r, i) => `${i + 1}. ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                });
            }

            // =========================
            // TOP 10
            // =========================

            if (cmd === 'top') {
                const usuariosArray = Object.entries(usuarios).map(([id, user]) => ({
                    id,
                    nombre: user.nombre,
                    rango: user.rango,
                    xp: user.xp || 0,
                    puntuacion: calcularPuntuacionRango(user.rango, user.xp || 0)
                }));

                usuariosArray.sort((a, b) => b.puntuacion - a.puntuacion);
                const top10 = usuariosArray.slice(0, 10);

                if (top10.length === 0) {
                    return sock.sendMessage(rawFrom, { text: '⚠️ No hay usuarios con runas aún.' });
                }

                const topLista = top10.map((user, index) => {
                    const config = XP_CONFIG[user.rango];
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    return `${medal} ${user.nombre}\n   ⭐ ${user.rango.toUpperCase()}\n   💫 ${user.xp}/${config.xpRequerida} XP`;
                }).join('\n\n');

                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n    🏆 TOP 10 PODEROSOS 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${topLista}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                });
            }

            // =========================
            // NIVEL
            // =========================

            if (cmd === 'nivel') {
                const targetId = userId;
                
                if (!usuarios[targetId]) {
                    return sock.sendMessage(rawFrom, { text: '⚠️ Ese usuario aún no tiene runas.' });
                }
                
                const target = usuarios[targetId];
                const xpActual = target.xp || 0;
                const config = XP_CONFIG[target.rango];
                const porcentajeXP = Math.round((xpActual / config.xpRequerida) * 100);
                const barraXP = crearBarra(porcentajeXP);
                
                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n    📊 ESTADÍSTICAS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 ${target.nombre}\n⭐ ${target.rango.toUpperCase()}\n💫 ${target.nucleo}\n\n${barraXP}\n\n${xpActual} / ${config.xpRequerida} XP\nProgreso: ${porcentajeXP}%\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                });
            }

            // =========================
            // SETNOMBRE
            // =========================

            if (cmd === 'setnombre') {
                if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setnombre <nombre>' });
                user.nombre = args;
                marcarParaGuardar();
                return sock.sendMessage(rawFrom, { text: `✨ Tu nombre ha sido cambiado a: ${args}` });
            }

            // =========================
            // RUNAS
            // =========================

            if (cmd === 'runas') {
                return sock.sendMessage(rawFrom, { text: format(user) });
            }

            // =========================
            // VERNOMBRE
            // =========================

            if (cmd === 'vernombre') {
                const desc = user.descVerdadero ? `${user.descVerdadero}` : 'Sin descripción.';
                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n    ◈ NOMBRE VERDADERO ◈\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${user.nombreVerdadero}\n\n───────────────────────\n${desc}\n───────────────────────`
                });
            }

            // =========================
            // VERATRIBUTOS
            // =========================

            if (cmd === 'veratributos') {
                return sock.sendMessage(rawFrom, { text: formatDetalle('ATRIBUTOS', user.atributos) });
            }

            // =========================
            // VERRECUERDOS
            // =========================

            if (cmd === 'verrecuerdos') {
                return sock.sendMessage(rawFrom, { text: formatDetalle('RECUERDOS', user.recuerdos) });
            }

            // =========================
            // VERECOS
            // =========================

            if (cmd === 'verecos') {
                return sock.sendMessage(rawFrom, { text: formatDetalle('ECOS', user.ecos) });
            }

            // =========================
            // PROTECCIÓN ADMIN/OWNER
            // =========================

            const adminCmds = [
                'setrango', 'setnucleo', 'setverdadero', 'descverdadero',
                'addatributo', 'addrecuerdo', 'addeco',
                'delatributo', 'delrecuerdo', 'deleco',
                'reset', 'xp'
            ];

            const ownerOnlyCmds = ['resetall'];

            if (adminCmds.includes(cmd)) {
                if (!canUseAdminCmds) return sock.sendMessage(rawFrom, { text: '⚠️ No tienes permiso. Solo admins y owners.' });
            } else if (ownerOnlyCmds.includes(cmd)) {
                if (!isOwner) return sock.sendMessage(rawFrom, { text: '⚠️ Solo owners.' });
            } else if (![  'help', 'top', 'nivel', 'miid', 'runas', 'vernombre', 'veratributos', 'verrecuerdos', 'verecos', 'setnombre'].includes(cmd)) {
                return;
            }

            // =========================
            // OBTENER TARGET CON MENCIÓN
            // =========================

            let targetId = userId;
            const mentions = getMentionedUsers(message);
            
            if (mentions.length > 0) {
                targetId = mentions[0];
            }

            if (!usuarios[targetId]) usuarios[targetId] = createUser();
            const target = usuarios[targetId];

            // =========================
            // COMANDOS ADMIN
            // =========================

            switch (cmd) {

                case 'setverdadero':
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setverdadero <nombre>' });
                    target.nombreVerdadero = args;
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { 
                        text: `✨ Nombre verdadero → ${args}`,
                        mentions: [targetId + '@s.whatsapp.net']
                    });

                case 'descverdadero':
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !descverdadero <descripcion>' });
                    target.descVerdadero = args;
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✨ Descripción actualizada.` });

                case 'setrango': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setrango @user <rango>' });
                    
                    const rango = args.split(' ').pop().toLowerCase();
                    
                    if (!RANGOS.includes(rango)) {
                        return sock.sendMessage(rawFrom, { text: `⚠️ Rango inválido.\n\n${RANGOS.join('\n')}` });
                    }
                    
                    target.rango = rango;
                    target.xp = 0;
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { 
                        text: `✨ @${targetId} ahora es ${rango.toUpperCase()}`,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                case 'setnucleo': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setnucleo @user <nucleo>' });
                    
                    const nucleo = args.split(' ').pop();
                    
                    target.nucleo = nucleo;
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { 
                        text: `✨ Núcleo de @${targetId} → ${nucleo}`,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                case 'addatributo': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !addatributo "nombre" "desc"' });
                    const { nombre, desc } = parseNombreDesc(args);
                    const found = target.atributos.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
                    if (found) { 
                        if (desc) found.desc = desc;
                        marcarParaGuardar();
                        return sock.sendMessage(rawFrom, { text: `✨ Atributo "${nombre}" actualizado.` });
                    }
                    target.atributos.push({ nombre, desc: desc || null });
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✨ Atributo "${nombre}" agregado.` });
                }

                case 'addrecuerdo': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !addrecuerdo "nombre" "desc"' });
                    const { nombre, desc } = parseNombreDesc(args);
                    const found = target.recuerdos.find(r => r.nombre.toLowerCase() === nombre.toLowerCase());
                    if (found) { 
                        if (desc) found.desc = desc;
                        marcarParaGuardar();
                        return sock.sendMessage(rawFrom, { text: `✨ Recuerdo "${nombre}" actualizado.` });
                    }
                    target.recuerdos.push({ nombre, desc: desc || null });
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✨ Recuerdo "${nombre}" agregado.` });
                }

                case 'addeco': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !addeco "nombre" "desc"' });
                    const { nombre, desc } = parseNombreDesc(args);
                    const found = target.ecos.find(e => e.nombre.toLowerCase() === nombre.toLowerCase());
                    if (found) { 
                        if (desc) found.desc = desc;
                        marcarParaGuardar();
                        return sock.sendMessage(rawFrom, { text: `✨ Eco "${nombre}" actualizado.` });
                    }
                    target.ecos.push({ nombre, desc: desc || null });
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✨ Eco "${nombre}" agregado.` });
                }

                case 'delatributo': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !delatributo <nombre>' });
                    const index = target.atributos.findIndex(a => a.nombre.toLowerCase() === args.toLowerCase());
                    if (index === -1) return sock.sendMessage(rawFrom, { text: '⚠️ Ese atributo no existe.' });
                    const removed = target.atributos.splice(index, 1)[0];
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✅ Atributo "${removed.nombre}" eliminado.` });
                }

                case 'delrecuerdo': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !delrecuerdo <nombre>' });
                    const index = target.recuerdos.findIndex(r => r.nombre.toLowerCase() === args.toLowerCase());
                    if (index === -1) return sock.sendMessage(rawFrom, { text: '⚠️ Ese recuerdo no existe.' });
                    const removed = target.recuerdos.splice(index, 1)[0];
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✅ Recuerdo "${removed.nombre}" eliminado.` });
                }

                case 'deleco': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !deleco <nombre>' });
                    const index = target.ecos.findIndex(e => e.nombre.toLowerCase() === args.toLowerCase());
                    if (index === -1) return sock.sendMessage(rawFrom, { text: '⚠️ Ese eco no existe.' });
                    const removed = target.ecos.splice(index, 1)[0];
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `✅ Eco "${removed.nombre}" eliminado.` });
                }

                case 'reset': {
                    usuarios[targetId] = createUser();
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { 
                        text: `🔄 Runas de @${targetId} han sido reseteadas.`,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                case 'resetall': {
                    for (let key in usuarios) {
                        delete usuarios[key];
                    }
                    
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `🔄 TODAS las runas han sido reseteadas.` });
                }

                case 'xp': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !xp @user <cantidad> o !xp <cantidad>' });
                    
                    const partes = args.split(' ');
                    const cantidad = parseInt(partes[partes.length - 1]);
                    
                    if (isNaN(cantidad)) return sock.sendMessage(rawFrom, { text: '⚠️ Debe ser un número.' });
                    
                    const resultado = añadirXPDirecto(targetId, cantidad);
                    const config = XP_CONFIG[resultado.rangoFinal];
                    
                    let respuesta = `${cantidad > 0 ? '✨ +' : '⚡'}${cantidad} XP para @${targetId}\n\n⭐ ${resultado.rangoFinal.toUpperCase()}\n💫 ${resultado.xpFinal}/${config.xpRequerida}`;
                    
                    if (resultado.ascensos.length > 0) {
                        respuesta = `🎆 ¡ASCENSO! 🎆\n\n`;
                        resultado.ascensos.forEach(a => {
                            respuesta += `${a.anterior.toUpperCase()} → ${a.nuevo.toUpperCase()}\n`;
                        });
                        respuesta += `\n⭐ ${resultado.rangoFinal.toUpperCase()}\n💫 ${resultado.xpFinal}/${config.xpRequerida}`;
                    }
                    
                    return sock.sendMessage(rawFrom, { 
                        text: respuesta,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                default:
                    return;
            }

        } catch (error) {
            console.error('Error en mensaje:', error);
        }

    });
}

// Iniciar
start().catch(err => {
    console.log('Error fatal:', err);
    setTimeout(() => start(), 5000);
});