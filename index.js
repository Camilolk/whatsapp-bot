const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// =========================
// ⚔ CONFIG HECHIZO
// =========================

const PREFIX = '!';

const OWNERS = new Set([
    '573004279762',
    '573117415491',
    '5491128539362',
    '45062830428357',
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
    durmiente: {
        xpRequerida: 1500,
        xpPorMensaje: 5,
        multiplicador: 1
    },
    despierto: {
        xpRequerida: 5000,
        xpPorMensaje: 4,
        multiplicador: 1.2
    },
    maestro: {
        xpRequerida: 15000,
        xpPorMensaje: 3,
        multiplicador: 1.5
    },
    santo: {
        xpRequerida: 50000,
        xpPorMensaje: 2,
        multiplicador: 2.5
    },
    supremo: {
        xpRequerida: 150000,
        xpPorMensaje: 1,
        multiplicador: 4
    },
    sagrado: {
        xpRequerida: 300000,
        xpPorMensaje: 1,
        multiplicador: 5
    },
    divino: {
        xpRequerida: 1000000,
        xpPorMensaje: 1,
        multiplicador: 5
    }
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
// CACHE DE CONTACTOS
// =========================

const contactCache = {};

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
// CLIENTE - OPTIMIZADO
// =========================

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-sync',
            '--disable-extensions',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--disable-preconnect'
        ]
    }
});

// =========================
// UTILIDAD: extrae el ID limpio
// =========================

function extractUserId(raw) {
    if (!raw) return null;
    const base = raw.includes('@') ? raw.split('@')[0] : raw;
    return base.replace(/\D/g, '') || null;
}

// =========================
// UTILIDAD: obtener nombre del contacto CON CACHE
// =========================

async function obtenerNombreContacto(userId) {
    try {
        // Verificar cache primero
        if (contactCache[userId]) {
            return contactCache[userId];
        }
        
        const contact = await client.getContactById(userId + '@c.us');
        if (contact) {
            const nombre = contact.name || contact.pushname || contact.shortName || null;
            if (nombre) {
                contactCache[userId] = nombre; // Guardar en cache
            }
            return nombre;
        }
        return null;
    } catch (error) {
        return null;
    }
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
// FUNCIÓN: Calcular puntuación de rango
// =========================

function calcularPuntuacionRango(rango, xp) {
    const rangoIndex = RANGOS.indexOf(rango);
    return (rangoIndex * 1000000) + xp;
}

// =========================
// FUNCIÓN: Añadir XP (mensajes normales)
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
// QR
// =========================

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// =========================
// READY
// =========================

client.on('ready', () => {
    console.log(`
🔮══════════════════════🔮
   HECHIZO ESTABLE
   RUNAS ACTIVAS
   MODO OPTIMIZADO ⚡
🔮══════════════════════🔮
    `);
    
    // Guardar cada 2 minutos en lugar de 30 segundos
    saveInterval = setInterval(guardarUsuarios, 120000);
});

// =========================
// MENSAJES
// =========================

client.on('message', async (message) => {

    const chat = await message.getChat();
    const rawAuthor = message.author || message.from || '';
    const userId = extractUserId(rawAuthor);

    if (!userId) return;

    const isOwner = OWNERS.has(userId);
    
    let isAdmin = false;
    try {
        if (chat.isGroup) {
            const participant = chat.participants.find(p => {
                const pId = p.id.user || p.id._serialized || extractUserId(p.id.toString());
                return pId === userId;
            });
            if (participant && (participant.isAdmin === true || participant.isSuperAdmin === true)) {
                isAdmin = true;
            }
        }
    } catch (error) {
        //
    }
    
    const canUseAdminCmds = isOwner || isAdmin;

    if (!usuarios[userId]) usuarios[userId] = createUser();
    const user = usuarios[userId];

    const body = (message.body || '').toString().trim();
    
    // =========================
    // SISTEMA DE XP
    // =========================
    
    if (!body.startsWith(PREFIX) && body.length > 0) {
        const resultadoXP = añadirXP(userId, XP_CONFIG[user.rango].xpPorMensaje);
        
        if (resultadoXP.subioDe) {
            const nombreContacto = await obtenerNombreContacto(userId);
            const nombre = nombreContacto || user.nombre;
            
            await message.reply(
`🎆 ¡ASCENSO! 🎆

${nombre} ha ascendido de rango

${resultadoXP.rangoAnterior.toUpperCase()} → ${resultadoXP.rangoNuevo.toUpperCase()}

⭐ ¡Felicidades! ⭐`
            );
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
        const nombreContacto = await obtenerNombreContacto(userId);
        return message.reply(`🔮 Tu Hechizo ID:\n${userId}\n\nNombre: ${nombreContacto || 'No disponible'}\nIs Owner: ${isOwner}\nIs Admin: ${isAdmin}`);
    }

    // =========================
    // HELP PRINCIPAL
    // =========================

    if (cmd === 'help' && args === '') {
        return message.reply(
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
        🔮 R U N A S 🔮
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 COMANDOS DE CONSULTA
───────────────────────
!runas          → Ver tus runas
!runas @user    → Ver runas de otro
!miid           → Tu ID real
!nivel          → Tu nivel y XP
!nivel @user    → Nivel de otro
!top            → Top 10 mejores

📜 VER DETALLES
───────────────────────
!vernombre      → Nombre verdadero
!veratributos   → Atributos + desc
!verrecuerdos   → Recuerdos + desc
!verecos        → Ecos + desc

Usa @usuario al final para ver de otros

━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 PARA TODOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

!setnombre <name> → Elige tu nombre

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ ADMIN/OWNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 IDENTIDAD
───────────────────────
!setrango <rango>         → Tu rango
!setrango @user <rango>   → Rango a otro
!setnucleo <nucleo>       → Tu núcleo
!setnucleo @user <nucleo> → Núcleo a otro
!setverdadero <nombre>    → Nombre verdadero
!descverdadero <desc>     → Descripción

📝 AGREGAR RUNAS
───────────────────────
!addatributo "nombre" "desc"
!addrecuerdo "nombre" "desc"
!addeco "nombre" "desc"

🗑️ ELIMINAR RUNAS
───────────────────────
!delatributo <nombre>
!delrecuerdo <nombre>
!deleco <nombre>

⚡ XP Y RANKING
───────────────────────
!xp <cantidad> [@]      → Añadir XP
!xp -<cantidad> [@]     → Restar XP

🔄 RESETEAR
───────────────────────
!reset          → Resetea tus runas
!reset @user    → Resetea a otro
!resetall       → Resetea TODO ⚠️

🎯 RANGOS DISPONIBLES
───────────────────────
${RANGOS.map((r, i) => `${i + 1}. ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
    }

    // =========================
    // HELP DIVINO
    // =========================

    if (cmd === 'divino') {
        return message.reply(
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    👑 PODERES DIVINOS 👑
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌟 SOLO PARA RANGO DIVINO 🌟

⚡ OTORGAR XP
!otorgar <xp> @user

💫 IMPULSAR
!impulsar @user

⚖️ CASTIGAR
!castigar <xp> @user

📊 ESTADÍSTICAS
!estadisticas

🎁 RECOMPENSAR
!recompensar <xp> @user "razón"

🔮 INVOCAR
!invocar "mensaje"

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
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
            return message.reply('⚠️ No hay usuarios con runas aún.');
        }

        const topLista = top10.map((user, index) => {
            const config = XP_CONFIG[user.rango];
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} ${user.nombre}\n   ⭐ ${user.rango.toUpperCase()}\n   💫 ${user.xp}/${config.xpRequerida} XP`;
        }).join('\n\n');

        return message.reply(
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🏆 TOP 10 PODEROSOS 🏆
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${topLista}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
    }

    // =========================
    // NIVEL Y XP
    // =========================

    if (cmd === 'nivel') {
        let targetId = userId;
        
        if (message.mentionedIds && message.mentionedIds.length > 0) {
            const rawMention = message.mentionedIds[0];
            const mentionId = extractUserId(
                typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
            );
            if (mentionId && usuarios[mentionId]) {
                targetId = mentionId;
            }
        }
        
        if (!usuarios[targetId]) return message.reply('⚠️ Ese usuario aún no tiene runas.');
        
        const target = usuarios[targetId];
        let nombreContacto = await obtenerNombreContacto(targetId);
        if (nombreContacto) target.nombre = nombreContacto;
        const nombre = nombreContacto || target.nombre;
        
        const xpActual = target.xp || 0;
        const config = XP_CONFIG[target.rango];
        const porcentajeXP = Math.round((xpActual / config.xpRequerida) * 100);
        const barraXP = crearBarra(porcentajeXP);
        
        const esDivino = target.rango === 'divino' ? '\n\n⚡ MULTIPLICADOR DIVINO x3 ACTIVO' : '';
        
        return message.reply(
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📊 ESTADÍSTICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 ${nombre}

⭐ RANGO ACTUAL
───────────────────────
${target.rango.toUpperCase()}

💫 NÚCLEO
───────────────────────
${target.nucleo || 'Sin núcleo'}

📈 EXPERIENCIA
───────────────────────
${xpActual} / ${config.xpRequerida} XP

${barraXP}

Progreso: ${porcentajeXP}%
${esDivino}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
    }

    // =========================
    // SETNOMBRE
    // =========================

    if (cmd === 'setnombre') {
        if (!args) return message.reply('⚠️ Uso: !setnombre <nombre>');
        user.nombre = args;
        marcarParaGuardar();
        return message.reply(`✨ Tu nombre ha sido cambiado a: ${args}`);
    }

    // =========================
    // RESOLVER TARGET (lecturas)
    // =========================

    async function resolveReadTarget() {
        if (message.mentionedIds && message.mentionedIds.length > 0) {
            const rawMention = message.mentionedIds[0];
            const mentionId = extractUserId(
                typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
            );
            if (!mentionId) return { id: null, u: null, err: '⚠️ No pude identificar a ese usuario.' };
            if (!usuarios[mentionId]) return { id: mentionId, u: null, err: 'Las runas de ese ser aún no han sido escritas.' };
            
            const nombreContacto = await obtenerNombreContacto(mentionId);
            if (nombreContacto) {
                usuarios[mentionId].nombre = nombreContacto;
            }
            return { id: mentionId, u: usuarios[mentionId], err: null };
        }
        return { id: userId, u: user, err: null };
    }

    // =========================
    // RUNAS
    // =========================

    if (cmd === 'runas') {
        const { id, u, err } = await resolveReadTarget();
        if (err) return message.reply(err);
        return message.reply(format(u));
    }

    // =========================
    // VERNOMBRE
    // =========================

    if (cmd === 'vernombre') {
        const { id, u, err } = await resolveReadTarget();
        if (err) return message.reply(err);

        const desc = u.descVerdadero ? `${u.descVerdadero}` : 'Sin descripción.';
        return message.reply(
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ◈ NOMBRE VERDADERO ◈
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${u.nombreVerdadero}

───────────────────────
${desc}
───────────────────────`
        );
    }

    // =========================
    // VERATRIBUTOS
    // =========================

    if (cmd === 'veratributos') {
        const { id, u, err } = await resolveReadTarget();
        if (err) return message.reply(err);
        return message.reply(formatDetalle('ATRIBUTOS', u.atributos));
    }

    // =========================
    // VERRECUERDOS
    // =========================

    if (cmd === 'verrecuerdos') {
        const { id, u, err } = await resolveReadTarget();
        if (err) return message.reply(err);
        return message.reply(formatDetalle('RECUERDOS', u.recuerdos));
    }

    // =========================
    // VERECOS
    // =========================

    if (cmd === 'verecos') {
        const { id, u, err } = await resolveReadTarget();
        if (err) return message.reply(err);
        return message.reply(formatDetalle('ECOS', u.ecos));
    }

    // =========================
    // PROTECCIÓN ADMIN/OWNER
    // =========================

    const adminCmds = [
        'setverdadero', 'descverdadero',
        'setrango', 'setnucleo',
        'addatributo', 'addrecuerdo', 'addeco',
        'delatributo', 'delrecuerdo', 'deleco',
        'reset', 'resetall', 'xp',
        'otorgar', 'impulsar', 'castigar',
        'estadisticas', 'recompensar', 'invocar'
    ];

    if (adminCmds.includes(cmd)) {
        if (!canUseAdminCmds) return message.reply('⚠️ No tienes permiso. Solo admins y owners.');
    } else {
        return;
    }

    // =========================
    // EXTRAER TARGET Y PARÁMETROS
    // =========================

    let targetId = userId;
    let hasMention = false;

    if (message.mentionedIds && message.mentionedIds.length > 0) {
        const rawMention = message.mentionedIds[0];
        const mentionId = extractUserId(
            typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
        );
        if (mentionId) {
            targetId = mentionId;
            hasMention = true;
        }
    }

    if (!usuarios[targetId]) usuarios[targetId] = createUser();
    const target = usuarios[targetId];
    
    const nombreContactoTarget = await obtenerNombreContacto(targetId);
    if (nombreContactoTarget) target.nombre = nombreContactoTarget;

    // =========================
    // COMANDOS
    // =========================

    switch (cmd) {

        case 'setverdadero':
            if (!args) return message.reply('⚠️ Uso: !setverdadero <nombre>');
            target.nombreVerdadero = args;
            marcarParaGuardar();
            return message.reply(`✨ Nombre verdadero → ${args}`);

        case 'descverdadero':
            if (!args) return message.reply('⚠️ Uso: !descverdadero <descripcion>');
            target.descVerdadero = args;
            marcarParaGuardar();
            return message.reply(`✨ Descripción actualizada.`);

        case 'setrango': {
            if (!args) return message.reply('⚠️ Uso: !setrango <rango> o !setrango @user <rango>');
            
            let rango = '';
            
            if (hasMention) {
                rango = args.split(' ')[0].toLowerCase();
            } else {
                rango = args.toLowerCase();
            }
            
            if (!RANGOS.includes(rango)) {
                return message.reply(`⚠️ Rango inválido.\n\nVálidos:\n${RANGOS.join('\n')}`);
            }
            
            target.rango = rango;
            target.xp = 0;
            marcarParaGuardar();
            return message.reply(`✨ Rango de ${target.nombre} → ${rango.toUpperCase()}`);
        }

        case 'setnucleo': {
            if (!args) return message.reply('⚠️ Uso: !setnucleo <nucleo> o !setnucleo @user <nucleo>');
            
            let nucleo = '';
            
            if (hasMention) {
                nucleo = args.split(' ')[0];
            } else {
                nucleo = args;
            }
            
            target.nucleo = nucleo;
            marcarParaGuardar();
            return message.reply(`✨ Núcleo de ${target.nombre} → ${nucleo}`);
        }

        case 'addatributo': {
            if (!args) return message.reply('⚠️ Uso: !addatributo "nombre" "desc"');
            const { nombre, desc } = parseNombreDesc(args);
            const found = target.atributos.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
            if (found) { 
                if (desc) found.desc = desc;
                marcarParaGuardar();
                return message.reply(`✨ Atributo "${nombre}" actualizado.`);
            }
            target.atributos.push({ nombre, desc: desc || null });
            marcarParaGuardar();
            return message.reply(`✨ Atributo "${nombre}" agregado.`);
        }

        case 'addrecuerdo': {
            if (!args) return message.reply('⚠️ Uso: !addrecuerdo "nombre" "desc"');
            const { nombre, desc } = parseNombreDesc(args);
            const found = target.recuerdos.find(r => r.nombre.toLowerCase() === nombre.toLowerCase());
            if (found) { 
                if (desc) found.desc = desc;
                marcarParaGuardar();
                return message.reply(`✨ Recuerdo "${nombre}" actualizado.`);
            }
            target.recuerdos.push({ nombre, desc: desc || null });
            marcarParaGuardar();
            return message.reply(`✨ Recuerdo "${nombre}" agregado.`);
        }

        case 'addeco': {
            if (!args) return message.reply('⚠️ Uso: !addeco "nombre" "desc"');
            const { nombre, desc } = parseNombreDesc(args);
            const found = target.ecos.find(e => e.nombre.toLowerCase() === nombre.toLowerCase());
            if (found) { 
                if (desc) found.desc = desc;
                marcarParaGuardar();
                return message.reply(`✨ Eco "${nombre}" actualizado.`);
            }
            target.ecos.push({ nombre, desc: desc || null });
            marcarParaGuardar();
            return message.reply(`✨ Eco "${nombre}" agregado.`);
        }

        case 'delatributo': {
            if (!args) return message.reply('⚠️ Uso: !delatributo <nombre>');
            const index = target.atributos.findIndex(a => a.nombre.toLowerCase() === args.toLowerCase());
            if (index === -1) return message.reply('⚠️ Ese atributo no existe.');
            const removed = target.atributos.splice(index, 1)[0];
            marcarParaGuardar();
            return message.reply(`✅ Atributo "${removed.nombre}" eliminado.`);
        }

        case 'delrecuerdo': {
            if (!args) return message.reply('⚠️ Uso: !delrecuerdo <nombre>');
            const index = target.recuerdos.findIndex(r => r.nombre.toLowerCase() === args.toLowerCase());
            if (index === -1) return message.reply('⚠️ Ese recuerdo no existe.');
            const removed = target.recuerdos.splice(index, 1)[0];
            marcarParaGuardar();
            return message.reply(`✅ Recuerdo "${removed.nombre}" eliminado.`);
        }

        case 'deleco': {
            if (!args) return message.reply('⚠️ Uso: !deleco <nombre>');
            const index = target.ecos.findIndex(e => e.nombre.toLowerCase() === args.toLowerCase());
            if (index === -1) return message.reply('⚠️ Ese eco no existe.');
            const removed = target.ecos.splice(index, 1)[0];
            marcarParaGuardar();
            return message.reply(`✅ Eco "${removed.nombre}" eliminado.`);
        }

        case 'reset': {
            let targetId2 = userId;
            
            if (message.mentionedIds && message.mentionedIds.length > 0) {
                const rawMention = message.mentionedIds[0];
                const mentionId = extractUserId(
                    typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
                );
                if (mentionId) targetId2 = mentionId;
            }
            
            if (!canUseAdminCmds && targetId2 !== userId) {
                return message.reply('⚠️ No tienes permiso para resetear a otro usuario.');
            }
            
            usuarios[targetId2] = createUser();
            marcarParaGuardar();
            
            const quien = targetId2 === userId ? 'Tus runas' : `Runas de ${targetId2}`;
            return message.reply(`🔄 ${quien} han sido reseteadas.`);
        }

        case 'resetall': {
            if (!isOwner) return message.reply('⚠️ Solo owners pueden hacer esto.');
            
            for (let key in usuarios) {
                delete usuarios[key];
            }
            
            marcarParaGuardar();
            return message.reply(`🔄 TODAS las runas han sido reseteadas.`);
        }

        case 'xp': {
            if (!args) return message.reply('⚠️ Uso: !xp <cantidad> [@usuario]');
            
            let xpStr = '';
            
            if (hasMention) {
                xpStr = args.split(' ')[0];
            } else {
                xpStr = args.split(' ')[0];
            }
            
            const cantidad = parseInt(xpStr);
            
            if (isNaN(cantidad)) return message.reply('⚠️ La cantidad debe ser un número.');
            
            const MAX_XP = 9999999999;
            if (Math.abs(cantidad) > MAX_XP) {
                return message.reply(`⚠️ Límite máximo: ${MAX_XP.toLocaleString()} XP.`);
            }
            
            const resultado = añadirXPDirecto(targetId, cantidad);
            
            const cambioStr = cantidad > 0 
                ? `✨ +${cantidad.toLocaleString()} XP`
                : `⚡ ${cantidad.toLocaleString()} XP`;
            
            let respuesta = `${cambioStr} a ${target.nombre}\n\n`;
            
            if (resultado.ascensos.length > 0) {
                respuesta += `🎆 ¡ASCENSOS! 🎆\n`;
                resultado.ascensos.forEach(a => {
                    respuesta += `${a.anterior.toUpperCase()} → ${a.nuevo.toUpperCase()}\n`;
                });
                respuesta += '\n';
            }
            
            const config = XP_CONFIG[resultado.rangoFinal];
            respuesta += `⭐ Rango: ${resultado.rangoFinal.toUpperCase()}\n`;
            respuesta += `💫 XP: ${resultado.xpFinal}/${config.xpRequerida}`;
            
            return message.reply(respuesta);
        }

        case 'otorgar': {
            if (user.rango !== 'divino') {
                return message.reply('⚠️ Solo rango DIVINO.');
            }
            
            if (!message.mentionedIds || message.mentionedIds.length === 0) {
                return message.reply('⚠️ Uso: !otorgar <xp> @usuario');
            }
            
            const xpMatch = args.match(/^\d+/);
            if (!xpMatch) return message.reply('⚠️ Uso: !otorgar <xp> @usuario');
            
            const xp = parseInt(xpMatch[0]);
            if (xp > 150000) return message.reply('⚠️ Máximo: 150,000 XP.');
            
            const cooldown = verificarCooldown(userId, 'otorgar', 20);
            if (cooldown.activo) {
                return message.reply(`⏳ Espera ${cooldown.tiempoRestante} min.`);
            }
            
            const rawMention = message.mentionedIds[0];
            const otroId = extractUserId(
                typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
            );
            
            if (!otroId) return message.reply('⚠️ Usuario no identificado.');
            if (!usuarios[otroId]) usuarios[otroId] = createUser();
            
            const otro = usuarios[otroId];
            const nombreContactoOtro = await obtenerNombreContacto(otroId);
            if (nombreContactoOtro) otro.nombre = nombreContactoOtro;
            
            const resultado = añadirXPDirecto(otroId, xp);
            const config = XP_CONFIG[resultado.rangoFinal];
            
            let respuesta = `✨ ${user.nombre} otorgó ${xp.toLocaleString()} XP a ${otro.nombre}\n\n`;
            
            if (resultado.ascensos.length > 0) {
                respuesta += `🎆 ¡Ascensos! 🎆\n`;
                resultado.ascensos.forEach(a => {
                    respuesta += `${a.anterior.toUpperCase()} → ${a.nuevo.toUpperCase()}\n`;
                });
                respuesta += '\n';
            }
            
            respuesta += `⭐ Nuevo rango: ${resultado.rangoFinal.toUpperCase()}\n`;
            respuesta += `💫 XP: ${resultado.xpFinal}/${config.xpRequerida}`;
            
            return message.reply(respuesta);
        }

        case 'impulsar': {
            if (user.rango !== 'divino') {
                return message.reply('⚠️ Solo rango DIVINO.');
            }
            
            if (!message.mentionedIds || message.mentionedIds.length === 0) {
                return message.reply('⚠️ Uso: !impulsar @usuario');
            }
            
            const cooldown = verificarCooldown(userId, 'impulsar', 720);
            if (cooldown.activo) {
                return message.reply(`⏳ Espera ${cooldown.tiempoRestante} min.`);
            }
            
            const rawMention = message.mentionedIds[0];
            const otroId = extractUserId(
                typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
            );
            
            if (!otroId) return message.reply('⚠️ Usuario no identificado.');
            if (!usuarios[otroId]) return message.reply('⚠️ Sin runas.');
            
            const otro = usuarios[otroId];
            const nombreContactoOtro = await obtenerNombreContacto(otroId);
            if (nombreContactoOtro) otro.nombre = nombreContactoOtro;
            
            const config = XP_CONFIG[otro.rango];
            
            if (otro.rango === 'divino') {
                return message.reply('⚠️ Ya es DIVINO.');
            }
            
            const xpFaltante = config.xpRequerida - (otro.xp || 0);
            const xpAOtorgar = Math.floor(xpFaltante * 0.6);
            
            const resultado = añadirXPDirecto(otroId, xpAOtorgar);
            const configFinal = XP_CONFIG[resultado.rangoFinal];
            
            let respuesta = `🚀 ${user.nombre} impulsó a ${otro.nombre}\n\n`;
            respuesta += `XP: ${xpAOtorgar.toLocaleString()} (60%)\n\n`;
            
            if (resultado.ascensos.length > 0) {
                respuesta += `🎆 ¡Subió de rango! 🎆\n`;
                resultado.ascensos.forEach(a => {
                    respuesta += `${a.anterior.toUpperCase()} → ${a.nuevo.toUpperCase()}\n`;
                });
                respuesta += '\n';
            }
            
            respuesta += `⭐ Rango: ${resultado.rangoFinal.toUpperCase()}\n`;
            respuesta += `💫 XP: ${resultado.xpFinal}/${configFinal.xpRequerida}`;
            
            return message.reply(respuesta);
        }

        case 'castigar': {
            if (user.rango !== 'divino') {
                return message.reply('⚠️ Solo rango DIVINO.');
            }
            
            if (!message.mentionedIds || message.mentionedIds.length === 0) {
                return message.reply('⚠️ Uso: !castigar <xp> @usuario');
            }
            
            const xpMatch = args.match(/^\d+/);
            if (!xpMatch) return message.reply('⚠️ Uso: !castigar <xp> @usuario');
            
            const xp = parseInt(xpMatch[0]);
            if (xp > 150000) return message.reply('⚠️ Máximo: 150,000 XP.');
            
            const cooldown = verificarCooldown(userId, 'castigar', 45);
            if (cooldown.activo) {
                return message.reply(`⏳ Espera ${cooldown.tiempoRestante} min.`);
            }
            
            const rawMention = message.mentionedIds[0];
            const otroId = extractUserId(
                typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
            );
            
            if (!otroId) return message.reply('⚠️ Usuario no identificado.');
            if (!usuarios[otroId]) return message.reply('⚠️ Sin runas.');
            
            const otro = usuarios[otroId];
            const nombreContactoOtro = await obtenerNombreContacto(otroId);
            if (nombreContactoOtro) otro.nombre = nombreContactoOtro;
            
            const resultado = añadirXPDirecto(otroId, -xp);
            const config = XP_CONFIG[resultado.rangoFinal];
            
            let respuesta = `⚡ ${user.nombre} castigó a ${otro.nombre}\n\n`;
            respuesta += `XP: -${xp.toLocaleString()}\n\n`;
            
            if (resultado.ascensos.length > 0) {
                respuesta += `📉 ¡Descendió! 📉\n`;
                resultado.ascensos.forEach(a => {
                    respuesta += `${a.anterior.toUpperCase()} → ${a.nuevo.toUpperCase()}\n`;
                });
                respuesta += '\n';
            }
            
            respuesta += `⭐ Rango: ${resultado.rangoFinal.toUpperCase()}\n`;
            respuesta += `💫 XP: ${resultado.xpFinal}/${config.xpRequerida}`;
            
            return message.reply(respuesta);
        }

        case 'estadisticas': {
            if (user.rango !== 'divino') {
                return message.reply('⚠️ Solo rango DIVINO.');
            }
            
            const usuariosArray = Object.entries(usuarios).map(([id, u]) => ({
                id,
                nombre: u.nombre,
                rango: u.rango,
                xp: u.xp || 0,
                puntuacion: calcularPuntuacionRango(u.rango, u.xp || 0)
            }));
            
            usuariosArray.sort((a, b) => b.puntuacion - a.puntuacion);
            
            const top5 = usuariosArray.slice(0, 5);
            const xpTotal = usuariosArray.reduce((sum, u) => sum + u.xp, 0);
            
            const top5Lista = top5.map((u, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                return `${medal} ${u.nombre} - ${u.rango.toUpperCase()}`;
            }).join('\n');
            
            return message.reply(
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📊 ESTADÍSTICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 USUARIOS: ${usuariosArray.length}

🏆 TOP 5
${top5Lista}

💫 XP TOTAL: ${xpTotal.toLocaleString()}

📈 DISTRIBUCIÓN
${RANGOS.map(r => {
    const count = usuariosArray.filter(u => u.rango === r).length;
    return `${r.toUpperCase()}: ${count}`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
            );
        }

        case 'recompensar': {
            if (user.rango !== 'divino') {
                return message.reply('⚠️ Solo rango DIVINO.');
            }
            
            if (!message.mentionedIds || message.mentionedIds.length === 0) {
                return message.reply('⚠️ Uso: !recompensar <xp> @usuario "razón"');
            }
            
            const xpMatch = args.match(/^\d+/);
            if (!xpMatch) return message.reply('⚠️ Uso: !recompensar <xp> @usuario "razón"');
            
            const xp = parseInt(xpMatch[0]);
            if (xp > 150000) return message.reply('⚠️ Máximo: 150,000 XP.');
            
            const razonMatch = args.match(/"(.+?)"/);
            const razon = razonMatch ? razonMatch[1] : 'Por un logro especial';
            
            const cooldown = verificarCooldown(userId, 'recompensar', 30);
            if (cooldown.activo) {
                return message.reply(`⏳ Espera ${cooldown.tiempoRestante} min.`);
            }
            
            const rawMention = message.mentionedIds[0];
            const otroId = extractUserId(
                typeof rawMention === 'string' ? rawMention : rawMention._serialized || rawMention.toString()
            );
            
            if (!otroId) return message.reply('⚠️ Usuario no identificado.');
            if (!usuarios[otroId]) usuarios[otroId] = createUser();
            
            const otro = usuarios[otroId];
            const nombreContactoOtro = await obtenerNombreContacto(otroId);
            if (nombreContactoOtro) otro.nombre = nombreContactoOtro;
            
            const resultado = añadirXPDirecto(otroId, xp);
            const config = XP_CONFIG[resultado.rangoFinal];
            
            let respuesta = `🎁 ${user.nombre} recompensó a ${otro.nombre}\n\n`;
            respuesta += `✨ ${xp.toLocaleString()} XP\n`;
            respuesta += `📋 ${razon}\n\n`;
            
            if (resultado.ascensos.length > 0) {
                respuesta += `🎆 ¡Ascensos! 🎆\n`;
                resultado.ascensos.forEach(a => {
                    respuesta += `${a.anterior.toUpperCase()} → ${a.nuevo.toUpperCase()}\n`;
                });
                respuesta += '\n';
            }
            
            respuesta += `⭐ Rango: ${resultado.rangoFinal.toUpperCase()}\n`;
            respuesta += `💫 XP: ${resultado.xpFinal}/${config.xpRequerida}`;
            
            return message.reply(respuesta);
        }

        case 'invocar': {
            if (user.rango !== 'divino') {
                return message.reply('⚠️ Solo rango DIVINO.');
            }
            
            if (!args) return message.reply('⚠️ Uso: !invocar "mensaje"');
            
            const cooldown = verificarCooldown(userId, 'invocar', 60);
            if (cooldown.activo) {
                return message.reply(`⏳ Espera ${cooldown.tiempoRestante} min.`);
            }
            
            const mensaje = args.replace(/^["']|["']$/g, '');
            
            const respuesta = `
╔═══════════════════════════════════╗
║  ⚡ INVOCACIÓN DIVINA ⚡          ║
║                                   ║
║  "${mensaje}"                    ║
║                                   ║
║  — ${user.nombre} —              ║
╚═══════════════════════════════════╝
            `;
            
            return message.reply(respuesta);
        }

        default:
            return;
    }

});

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

// =========================
// FORMATO DETALLE
// =========================

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
// INICIALIZACIÓN
// =========================

client.initialize();