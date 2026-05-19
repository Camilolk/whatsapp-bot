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
// ASPECTOS LEGADOS
// =========================

const ASPECTOS_LEGADOS = {
    'Portador de Runas': {
        nombre: 'Portador de Runas',
        descripcion: 'Canalizas el poder de las runas ancestrales. Tu cuerpo es un recipiente de conocimiento olvidado.',
        rareza: '⭐⭐⭐',
        rangoMinimo: 'despierto',
        pasos: 3,
        efectos: {
            multiplicadorXP: 1.2,
            descripcionEfecto: '+20% XP por mensajes'
        }
    },
    'Cazador de Sombras': {
        nombre: 'Cazador de Sombras',
        descripcion: 'Acechas en la penumbra. Los secretos oscuros se revelan ante tus ojos vigilantes.',
        rareza: '⭐⭐⭐⭐',
        rangoMinimo: 'maestro',
        pasos: 4,
        efectos: {
            multiplicadorXP: 1.35,
            descripcionEfecto: '+35% XP, acceso a !legadoinfo'
        }
    },
    'Silenciador de Ecos': {
        nombre: 'Silenciador de Ecos',
        descripcion: 'Los ecos de otros se desvanecen ante tu presencia. Tu voluntad resuena con autoridad.',
        rareza: '⭐⭐⭐⭐',
        rangoMinimo: 'maestro',
        pasos: 4,
        efectos: {
            multiplicadorXP: 1.3,
            descripcionEfecto: '+30% XP, poder sobre ecos ajenos'
        }
    },
    'Devorador de Recuerdos': {
        nombre: 'Devorador de Recuerdos',
        descripcion: 'Absorbes los recuerdos de otros. Su pasado se convierte en tu fortaleza.',
        rareza: '⭐⭐⭐⭐⭐',
        rangoMinimo: 'santo',
        pasos: 5,
        efectos: {
            multiplicadorXP: 1.5,
            descripcionEfecto: '+50% XP, robo de recuerdos'
        }
    },
    'Maldito Eterno': {
        nombre: 'Maldito Eterno',
        descripcion: 'Una maldición ancestral te ata a la rueda del sufrimiento. Solo mediante el dolor comes poder.',
        rareza: '⭐⭐⭐',
        rangoMinimo: 'despierto',
        pasos: 3,
        efectos: {
            multiplicadorXP: 1.15,
            descripcionEfecto: '+15% XP, resistencia a maldiciones'
        }
    },
    'Conspirador Profundo': {
        nombre: 'Conspirador Profundo',
        descripcion: 'Accedes a conocimientos prohibidos. Las entrañas del mundo revelan sus secretos.',
        rareza: '⭐⭐⭐⭐',
        rangoMinimo: 'maestro',
        pasos: 4,
        efectos: {
            multiplicadorXP: 1.4,
            descripcionEfecto: '+40% XP, verdades ocultas reveladas'
        }
    },
    'Guardián del Umbral': {
        nombre: 'Guardián del Umbral',
        descripcion: 'Custodias la puerta entre mundos. Eres el centinela de lo prohibido y lo permitido.',
        rareza: '⭐⭐⭐⭐',
        rangoMinimo: 'santo',
        pasos: 4,
        efectos: {
            multiplicadorXP: 1.38,
            descripcionEfecto: '+38% XP, control de fronteras'
        }
    },
    'Visionario Maldito': {
        nombre: 'Visionario Maldito',
        descripcion: 'Ves posibilidades que rompen la cordura. El futuro te susurra verdades terribles.',
        rareza: '⭐⭐⭐⭐⭐',
        rangoMinimo: 'supremo',
        pasos: 5,
        efectos: {
            multiplicadorXP: 1.6,
            descripcionEfecto: '+60% XP, predicciones fragmentadas'
        }
    },
    'Fragmento del Vacío': {
        nombre: 'Fragmento del Vacío',
        descripcion: 'Una parte del nada te habita. Existes en el espacio entre existencias.',
        rareza: '⭐⭐⭐⭐⭐',
        rangoMinimo: 'supremo',
        pasos: 5,
        efectos: {
            multiplicadorXP: 1.55,
            descripcionEfecto: '+55% XP, manipulación del espacio'
        }
    },
    'Heraldo de Calamidad': {
        nombre: 'Heraldo de Calamidad',
        descripcion: 'Anuncias el fin de eras. Tu presencia precede a la ruina y la transformación.',
        rareza: '⭐⭐⭐⭐',
        rangoMinimo: 'santo',
        pasos: 4,
        efectos: {
            multiplicadorXP: 1.45,
            descripcionEfecto: '+45% XP, aura de inevitable cambio'
        }
    },
    'Tejedor de Destinos': {
        nombre: 'Tejedor de Destinos',
        descripcion: 'Alteras las hebras del destino. Lo que fue inevitable ahora es maleable.',
        rareza: '⭐⭐⭐⭐⭐',
        rangoMinimo: 'sagrado',
        pasos: 5,
        efectos: {
            multiplicadorXP: 1.7,
            descripcionEfecto: '+70% XP, reescritura de narrativas'
        }
    },
    'Alma Gemela del Abismo': {
        nombre: 'Alma Gemela del Abismo',
        descripcion: 'El abismo reconoce tu esencia. Eres uno de los suyos, elevado y corrompido.',
        rareza: '⭐⭐⭐⭐⭐',
        rangoMinimo: 'sagrado',
        pasos: 5,
        efectos: {
            multiplicadorXP: 1.65,
            descripcionEfecto: '+65% XP, communión abismal'
        }
    },
    'Divino Degenerado': {
        nombre: 'Divino Degenerado',
        descripcion: 'Fuiste tocado por lo divino pero corrompiste su esencia. Eres lo prohibido hecho carne.',
        rareza: '⭐⭐⭐⭐⭐',
        rangoMinimo: 'divino',
        pasos: 5,
        efectos: {
            multiplicadorXP: 2.0,
            descripcionEfecto: '+100% XP, gloria caída'
        }
    }
};

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
const COHORTES_FILE = path.join(__dirname, 'cohortes.json');

function cargarUsuarios() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const usuariosData = JSON.parse(data);
            
            for (let key in usuariosData) {
                if (usuariosData[key].xp === undefined) usuariosData[key].xp = 0;
                if (usuariosData[key].clase === undefined) usuariosData[key].clase = 'sin clase';
                if (usuariosData[key].aspectoLegado === undefined) usuariosData[key].aspectoLegado = null;
                if (usuariosData[key].pasosAspecto === undefined) usuariosData[key].pasosAspecto = 0;
                if (usuariosData[key].cohorte === undefined) usuariosData[key].cohorte = null;
            }
            
            return usuariosData;
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            return {};
        }
    }
    return {};
}

function cargarCohortes() {
    if (fs.existsSync(COHORTES_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(COHORTES_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

let saveInterval = null;
let needsSave = false;
let botActivo = true;

function marcarParaGuardar() {
    needsSave = true;
}

function guardarUsuarios() {
    if (!needsSave) return;
    
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usuarios, null, 2), 'utf8');
        needsSave = false;
    } catch (error) {
        console.error('Error guardando usuarios:', error);
    }
}

function guardarCohortes() {
    try {
        fs.writeFileSync(COHORTES_FILE, JSON.stringify(cohortes, null, 2), 'utf8');
    } catch (error) {
        console.error('Error guardando cohortes:', error);
    }
}

const usuarios = cargarUsuarios();
let cohortes = cargarCohortes();

// =========================
// UTILIDAD: extrae el ID limpio
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
// FUNCIÓN: Obtener aspecto legado aleatorio
// =========================

function obtenerAspectoAleatorio(rango) {
    const aspectosDisponibles = Object.values(ASPECTOS_LEGADOS).filter(a => {
        const rangoUserIndex = RANGOS.indexOf(rango);
        const rangoMinIndex = RANGOS.indexOf(a.rangoMinimo);
        return rangoUserIndex >= rangoMinIndex;
    });
    
    if (aspectosDisponibles.length === 0) return null;
    return aspectosDisponibles[Math.floor(Math.random() * aspectosDisponibles.length)];
}

// =========================
// FUNCIÓN: Obtener aspecto específico por nombre
// =========================

function obtenerAspectoPorNombre(nombre) {
    return ASPECTOS_LEGADOS[nombre] || null;
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
    
    let xpGanada = Math.floor(cantidad * config.multiplicador);
    
    if (user.aspectoLegado) {
        const aspecto = ASPECTOS_LEGADOS[user.aspectoLegado];
        if (aspecto && user.pasosAspecto >= aspecto.pasos) {
            xpGanada = Math.floor(xpGanada * aspecto.efectos.multiplicadorXP);
        }
    }
    
    const xpFinal = user.rango === 'divino' ? xpGanada * 3 : xpGanada;
    user.xp += xpFinal;
    
    const rangoIndex = RANGOS.indexOf(rangoActual);
    
    if (rangoIndex < RANGOS.length - 1 && user.xp >= config.xpRequerida) {
        const nuevoRango = RANGOS[rangoIndex + 1];
        user.rango = nuevoRango;
        user.xp = 0;
        
        let tieneAspecto = false;
        if (!user.aspectoLegado) {
            const random = Math.random();
            const probabilidad = nuevoRango === 'despierto' ? 0.3 : nuevoRango === 'maestro' ? 0.4 : nuevoRango === 'santo' ? 0.5 : 0.6;
            
            if (random < probabilidad) {
                const aspecto = obtenerAspectoAleatorio(nuevoRango);
                if (aspecto) {
                    user.aspectoLegado = aspecto.nombre;
                    user.pasosAspecto = 0;
                    tieneAspecto = true;
                }
            }
        }
        
        marcarParaGuardar();
        
        return {
            subioDe: true,
            rangoAnterior: rangoActual,
            rangoNuevo: nuevoRango,
            xpGanada: xpFinal,
            tieneAspecto,
            aspecto: user.aspectoLegado
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
    let nuevoAspecto = null;
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
            
            if (!user.aspectoLegado) {
                const random = Math.random();
                const probabilidad = user.rango === 'despierto' ? 0.3 : user.rango === 'maestro' ? 0.4 : user.rango === 'santo' ? 0.5 : 0.6;
                
                if (random < probabilidad) {
                    const aspecto = obtenerAspectoAleatorio(user.rango);
                    if (aspecto) {
                        user.aspectoLegado = aspecto.nombre;
                        user.pasosAspecto = 0;
                        nuevoAspecto = user.aspectoLegado;
                    }
                }
            }
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
    
    return { ascensos, rangoFinal: user.rango, xpFinal: user.xp, nuevoAspecto };
}

// =========================
// COMANDOS DE COHORTE
// =========================

function crearCohorte(nombre, lider) {
    if (Object.values(cohortes).some(c => c.nombre === nombre)) {
        return { error: true, msg: '⚠️ Ese nombre de cohorte ya existe.' };
    }
    
    const cohortId = Math.random().toString(36).substring(7);
    cohortes[cohortId] = {
        id: cohortId,
        nombre,
        lider,
        miembros: [lider],
        xpTotal: 0,
        nivel: 1,
        creada: new Date().toISOString()
    };
    guardarCohortes();
    
    usuarios[lider].cohorte = cohortId;
    marcarParaGuardar();
    
    return { error: false, id: cohortId, msg: `✨ Cohorte "${nombre}" creada (ID: ${cohortId})` };
}

function unirseCohorte(userId, cohortId) {
    if (!cohortes[cohortId]) {
        return { error: true, msg: '⚠️ Cohorte no encontrada.' };
    }
    
    if (usuarios[userId]?.cohorte) {
        return { error: true, msg: '⚠️ Ya estás en una cohorte.' };
    }
    
    if (cohortes[cohortId].miembros.length >= 5) {
        return { error: true, msg: '⚠️ Cohorte llena (máx 5 miembros).' };
    }
    
    cohortes[cohortId].miembros.push(userId);
    usuarios[userId].cohorte = cohortId;
    guardarCohortes();
    marcarParaGuardar();
    
    return { error: false, msg: `✨ Te has unido a "${cohortes[cohortId].nombre}"` };
}

function salirCohorte(userId) {
    const cohortId = usuarios[userId]?.cohorte;
    if (!cohortId) return { error: true, msg: '⚠️ No estás en una cohorte.' };
    
    const cohorte = cohortes[cohortId];
    if (cohorte.lider === userId) {
        delete cohortes[cohortId];
        Object.keys(usuarios).forEach(k => {
            if (usuarios[k].cohorte === cohortId) usuarios[k].cohorte = null;
        });
        guardarCohortes();
        marcarParaGuardar();
        return { error: false, msg: `🔄 Cohorte "${cohorte.nombre}" eliminada.` };
    }
    
    cohorte.miembros = cohorte.miembros.filter(m => m !== userId);
    usuarios[userId].cohorte = null;
    guardarCohortes();
    marcarParaGuardar();
    
    return { error: false, msg: `✨ Saliste de "${cohorte.nombre}"` };
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
    if (!lista.length) return '   • Vacío';
    return lista.map(item => `   • ${item.nombre}`).join('\n');
}

// =========================
// FORMATO SIMPLE Y LIMPIO - MODIFICADO
// =========================

function format(u) {
    const xpActual = u.xp || 0;
    const xpRequerida = XP_CONFIG[u.rango].xpRequerida;
    const barraXP = crearBarra(Math.round((xpActual / xpRequerida) * 100));
    
    // Rango de Aspecto
    let rangoAspecto = 'Sin aspecto';
    let aspectoLegadoInfo = '';
    
    if (u.aspectoLegado) {
        const aspecto = ASPECTOS_LEGADOS[u.aspectoLegado];
        rangoAspecto = aspecto.rareza;
        
        const progreso = Math.round((u.pasosAspecto / aspecto.pasos) * 100);
        const barraAspecto = crearBarra(progreso);
        
        aspectoLegadoInfo = `

🌑 ASPECTO LEGADO: ${aspecto.nombre}
   ${aspecto.rareza}
   Progreso: ${barraAspecto}
   ${u.pasosAspecto}/${aspecto.pasos}`;
    }
    
    // Cohorte
    let cohortInfo = '';
    if (u.cohorte && cohortes[u.cohorte]) {
        const cohorte = cohortes[u.cohorte];
        cohortInfo = `

🔮 COHORTE: ${cohorte.nombre}
   👑 Líder: @${cohorte.lider}
   👥 Miembros: ${cohorte.miembros.length}/5`;
    }
    
    return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        📊 TUS RUNAS 📊
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nombre: ${u.nombre}

Nombre Verdadero: ${u.nombreVerdadero}

Rango: ${u.rango.toUpperCase()}

Rango de Aspecto: ${rangoAspecto}

Fragmentos de alma [XP]: ${xpActual}/${xpRequerida}
${barraXP}

Ecos:
${formatSoloNombres(u.ecos)}

Recuerdos:
${formatSoloNombres(u.recuerdos)}

Atributos:
${formatSoloNombres(u.atributos)}${aspectoLegadoInfo}${cohortInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
}

function formatDetalle(titulo, lista) {
    if (!lista.length) {
        return (
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ${titulo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

   • Vacío

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
    }

    const items = lista.map(item => {
        return item.desc
            ? `• ${item.nombre}\n   └─ ${item.desc}`
            : `• ${item.nombre}\n   └─ Sin descripción.`;
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
        nombre: 'Sin nombre',
        nombreVerdadero: '???',
        descVerdadero: null,
        rango: 'durmiente',
        clase: 'sin clase',
        xp: 0,
        recuerdos: [],
        ecos: [],
        atributos: [],
        aspectoLegado: null,
        pasosAspecto: 0,
        cohorte: null
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
        printQRInTerminal: true,
        browser: ['Hechizo Bot', 'Chrome', '120.0.0.0'],
        maxMsgsInMemory: 100,
        shouldIgnoreJid: (jid) => jid.includes('status@broadcast')
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 Escanea este QR:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log(`
🔮══════════════════════🔮
   HECHIZO ESTABLE ✅
   RUNAS ACTIVAS
   MODO OPTIMIZADO ⚡
🔮══════════════════════🔮
            `);
            if (!saveInterval) {
                saveInterval = setInterval(guardarUsuarios, 120000);
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconectando en 3 segundos...');
                setTimeout(() => start(), 3000);
            } else {
                console.log('❌ Desconectado por logout - escanea QR nuevamente');
                setTimeout(() => start(), 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const message = m.messages[0];
            if (!message.message) return;
            if (message.key.fromMe) return;

            // Si bot desactivado, solo owners pueden usar
            if (!botActivo) {
                const rawFrom = message.key.remoteJid;
                const userId = extractUserId(message.key.participant || rawFrom);
                if (!OWNERS.has(userId)) return;
            }

            const rawFrom = message.key.remoteJid;
            const userId = extractUserId(message.key.participant || rawFrom);
            const isGroup = rawFrom.includes('@g.us');
            
            if (!userId) return;

            const isOwner = OWNERS.has(userId);
            let isAdmin = false;
            
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
            
            if (!body.startsWith(PREFIX) && body.length > 0 && botActivo) {
                const resultadoXP = añadirXP(userId, XP_CONFIG[user.rango].xpPorMensaje);
                
                if (resultadoXP.subioDe) {
                    const nombre = user.nombre;
                    let msg = `🎆 ¡ASCENSO! 🎆\n\n${nombre} ha ascendido de rango\n\n${resultadoXP.rangoAnterior.toUpperCase()} → ${resultadoXP.rangoNuevo.toUpperCase()}\n\n⭐ ¡Felicidades! ⭐`;
                    
                    if (resultadoXP.tieneAspecto) {
                        const aspecto = ASPECTOS_LEGADOS[resultadoXP.aspecto];
                        msg += `\n\n🌑 ¡ASPECTO LEGADO OTORGADO!\n${aspecto.nombre} ${aspecto.rareza}\n\n"${aspecto.descripcion}"`;
                    }
                    
                    await sock.sendMessage(rawFrom, { text: msg });
                }
                
                return;
            }

            if (!body.startsWith(PREFIX)) return;

            const [cmdRaw, ...argsArr] = body.slice(PREFIX.length).split(' ');
            const cmd = cmdRaw.toLowerCase();
            const args = argsArr.join(' ').trim();

            // =========================
            // COMANDOS OWNER ESPECIALES
            // =========================

            if (cmd === 'activarbot') {
                if (!isOwner) return sock.sendMessage(rawFrom, { text: '⚠️ Solo owners' });
                botActivo = true;
                return sock.sendMessage(rawFrom, { text: '✅ Bot ACTIVADO - XP activo' });
            }

            if (cmd === 'desactivarbot') {
                if (!isOwner) return sock.sendMessage(rawFrom, { text: '⚠️ Solo owners' });
                botActivo = false;
                return sock.sendMessage(rawFrom, { text: '❌ Bot DESACTIVADO - Solo owners pueden usar comandos' });
            }

            if (cmd === 'estadobot') {
                if (!isOwner) return sock.sendMessage(rawFrom, { text: '⚠️ Solo owners' });
                const estado = botActivo ? '✅ ACTIVO' : '❌ DESACTIVADO';
                return sock.sendMessage(rawFrom, { text: `Estado del bot: ${estado}` });
            }

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
        🔮 COMANDOS 🔮
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 CONSULTA
!perfil, !nivel, !top, !miid
!legado - Ver tu aspecto legado

📜 VER DETALLES
!vernombre, !veratributos, !verrecuerdos, !verecos

👤 PARA TODOS
!setnombre <name>
!setclase <clase>

⚙️ ADMIN/OWNER
!setrango @user <rango>
!setclase @user <clase>
!setverdadero <nombre>
!xp @user <cantidad>
!reset @user
!desbloquearaspecto @user
!addatributo "nombre" "desc"
!addrecuerdo "nombre" "desc"
!addeco "nombre" "desc"
!delatributo <nombre>
!delrecuerdo <nombre>
!deleco <nombre>

🌑 ASPECTO LEGADO
!addaspecto <nombre_aspecto>
!addaspecto @user <nombre_aspecto>
!listaraspetos

🌑 COHORTE
!crearcohorte <nombre>
!unirseco <id>
!salirco
!miscohortes
!vercohorte

👑 OWNER SOLO
!activarbot
!desactivarbot
!estadobot
!resetall

🎯 RANGOS
${RANGOS.map((r, i) => `${i + 1}. ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                });
            }

            // =========================
            // LISTAR ASPECTOS
            // =========================

            if (cmd === 'listaraspetos') {
                const aspectosList = Object.values(ASPECTOS_LEGADOS).map(a => 
                    `• ${a.nombre} ${a.rareza}\n   Rango mín: ${a.rangoMinimo}\n   Pasos: ${a.pasos}`
                ).join('\n\n');

                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n    🌑 ASPECTOS DISPONIBLES 🌑\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${aspectosList}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
                    clase: user.clase,
                    xp: user.xp || 0,
                    aspectoLegado: user.aspectoLegado,
                    puntuacion: calcularPuntuacionRango(user.rango, user.xp || 0)
                }));

                usuariosArray.sort((a, b) => b.puntuacion - a.puntuacion);
                const top10 = usuariosArray.slice(0, 10);

                if (top10.length === 0) {
                    return sock.sendMessage(rawFrom, { text: '⚠️ No hay usuarios aún.' });
                }

                const topLista = top10.map((user, index) => {
                    const config = XP_CONFIG[user.rango];
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    const aspectoInfo = user.aspectoLegado ? `\n   🌑 ${user.aspectoLegado}` : '';
                    return `${medal} @${user.id}\n   📝 ${user.nombre}\n   ⭐ ${user.rango.toUpperCase()}\n   🎓 ${user.clase}\n   💫 ${user.xp}/${config.xpRequerida} XP${aspectoInfo}`;
                }).join('\n\n');

                const mentions = top10.map(u => u.id + '@s.whatsapp.net');

                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n    🏆 TOP 10 PODEROSOS 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${topLista}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                    mentions
                });
            }

            // =========================
            // NIVEL / PERFIL
            // =========================

            if (cmd === 'perfil' || cmd === 'nivel') {
                const targetId = userId;
                
                if (!usuarios[targetId]) {
                    return sock.sendMessage(rawFrom, { text: '⚠️ Usuario no encontrado.' });
                }
                
                const target = usuarios[targetId];
                return sock.sendMessage(rawFrom, { text: format(target) });
            }

            // =========================
            // LEGADO
            // =========================

            if (cmd === 'legado') {
                if (!user.aspectoLegado) {
                    return sock.sendMessage(rawFrom, { text: '⚠️ No posees un aspecto legado aún.' });
                }
                
                const aspecto = ASPECTOS_LEGADOS[user.aspectoLegado];
                const progreso = Math.round((user.pasosAspecto / aspecto.pasos) * 100);
                const barra = crearBarra(progreso);
                
                return sock.sendMessage(rawFrom, {
                    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n    🌑 ${aspecto.nombre.toUpperCase()} 🌑\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${aspecto.rareza}\n\n"${aspecto.descripcion}"\n\n───────────────────────\n💫 DESBLOQUEANDO PODER\n\n${barra}\n\nPasos: ${user.pasosAspecto}/${aspecto.pasos}\n\n⚡ Cuando se desbloquee:\n${aspecto.efectos.descripcionEfecto}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                });
            }

            // =========================
            // SETNOMBRE
            // =========================

            if (cmd === 'setnombre') {
                if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setnombre <nombre>' });
                user.nombre = args;
                marcarParaGuardar();
                return sock.sendMessage(rawFrom, { text: `✨ Tu nombre: ${args}` });
            }

            // =========================
            // SETCLASE
            // =========================

            if (cmd === 'setclase') {
                if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setclase <clase>' });
                user.clase = args;
                marcarParaGuardar();
                return sock.sendMessage(rawFrom, { text: `✨ Tu clase: ${args}` });
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
                'setrango', 'setclase', 'setverdadero', 'descverdadero',
                'addatributo', 'addrecuerdo', 'addeco',
                'delatributo', 'delrecuerdo', 'deleco',
                'reset', 'xp', 'desbloquearaspecto', 'crearcohorte',
                'addaspecto'
            ];

            const ownerOnlyCmds = ['resetall'];

            if (adminCmds.includes(cmd)) {
                if (!canUseAdminCmds) return sock.sendMessage(rawFrom, { text: '⚠️ No tienes permiso. Solo admins y owners.' });
            } else if (ownerOnlyCmds.includes(cmd)) {
                if (!isOwner) return sock.sendMessage(rawFrom, { text: '⚠️ Solo owners.' });
            } else if (![  'help', 'top', 'nivel', 'perfil', 'miid', 'runas', 'vernombre', 'veratributos', 'verrecuerdos', 'verecos', 'setnombre', 'setclase', 'legado', 'unirseco', 'salirco', 'miscohortes', 'vercohorte', 'listaraspetos'].includes(cmd)) {
                return;
            }

            // =========================
            // OBTENER TARGET
            // =========================

            let targetId = userId;
            const mentions = getMentionedUsers(message);
            
            if (mentions.length > 0) {
                targetId = mentions[0];
            }

            if (!usuarios[targetId]) usuarios[targetId] = createUser();
            const target = usuarios[targetId];

            // =========================
            // COMANDOS
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

                case 'setclase': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !setclase @user <clase>' });
                    
                    const clase = args.split(' ').pop();
                    
                    target.clase = clase;
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { 
                        text: `✨ Clase de @${targetId} → ${clase}`,
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

                case 'addaspecto': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !addaspecto <nombre_aspecto>\n        o !addaspecto @user <nombre_aspecto>' });
                    
                    // Si hay mención, tomar el aspecto del segundo argumento
                    let nombreAspecto = args;
                    
                    if (mentions.length > 0) {
                        // El usuario mencionado ya está en targetId
                        const palabras = args.split(' ');
                        nombreAspecto = palabras.slice(1).join(' ');
                    }
                    
                    nombreAspecto = nombreAspecto.trim();
                    
                    const aspecto = obtenerAspectoPorNombre(nombreAspecto);
                    
                    if (!aspecto) {
                        return sock.sendMessage(rawFrom, { text: `⚠️ Aspecto legado "${nombreAspecto}" no encontrado.\nUsa !listaraspetos para ver los disponibles.` });
                    }
                    
                    // Validar si el usuario tiene el rango mínimo
                    const rangoUserIndex = RANGOS.indexOf(target.rango);
                    const rangoMinIndex = RANGOS.indexOf(aspecto.rangoMinimo);
                    
                    if (rangoUserIndex < rangoMinIndex) {
                        return sock.sendMessage(rawFrom, { 
                            text: `⚠️ @${targetId} no tiene el rango mínimo para este aspecto.\nRango requerido: ${aspecto.rangoMinimo.toUpperCase()}\nRango actual: ${target.rango.toUpperCase()}` 
                        });
                    }
                    
                    if (target.aspectoLegado) {
                        return sock.sendMessage(rawFrom, { text: `⚠️ @${targetId} ya tiene un aspecto legado: ${target.aspectoLegado}` });
                    }
                    
                    target.aspectoLegado = nombreAspecto;
                    target.pasosAspecto = 0;
                    marcarParaGuardar();
                    
                    return sock.sendMessage(rawFrom, { 
                        text: `🌑 ¡ASPECTO LEGADO OTORGADO A @${targetId}!\n\n${aspecto.nombre} ${aspecto.rareza}\n\n"${aspecto.descripcion}"\n\n${aspecto.efectos.descripcionEfecto}`,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                case 'desbloquearaspecto': {
                    if (!target.aspectoLegado) {
                        return sock.sendMessage(rawFrom, { text: '⚠️ Este usuario no tiene aspecto legado.' });
                    }
                    
                    const aspecto = ASPECTOS_LEGADOS[target.aspectoLegado];
                    
                    if (target.pasosAspecto >= aspecto.pasos) {
                        return sock.sendMessage(rawFrom, { text: '✨ Este aspecto ya está completamente desbloqueado.' });
                    }
                    
                    target.pasosAspecto += 1;
                    marcarParaGuardar();
                    
                    const progreso = Math.round((target.pasosAspecto / aspecto.pasos) * 100);
                    const msg = target.pasosAspecto >= aspecto.pasos 
                        ? `🎆 ¡ASPECTO LEGADO DESBLOQUEADO!\n\n${aspecto.nombre}\n\n${aspecto.efectos.descripcionEfecto}`
                        : `📈 Progreso: ${target.pasosAspecto}/${aspecto.pasos}`;
                    
                    return sock.sendMessage(rawFrom, { 
                        text: msg,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                case 'reset': {
                    usuarios[targetId] = createUser();
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { 
                        text: `🔄 Perfil de @${targetId} ha sido reseteado.`,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                case 'resetall': {
                    for (let key in usuarios) {
                        delete usuarios[key];
                    }
                    
                    marcarParaGuardar();
                    return sock.sendMessage(rawFrom, { text: `🔄 TODOS los perfiles han sido reseteados.` });
                }

                case 'xp': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !xp @user <cantidad>' });
                    
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
                    
                    if (resultado.nuevoAspecto) {
                        const aspecto = ASPECTOS_LEGADOS[resultado.nuevoAspecto];
                        respuesta += `\n\n🌑 ¡ASPECTO LEGADO OTORGADO!\n${aspecto.nombre} ${aspecto.rareza}\n\n"${aspecto.descripcion}"`;
                    }
                    
                    return sock.sendMessage(rawFrom, { 
                        text: respuesta,
                        mentions: [targetId + '@s.whatsapp.net']
                    });
                }

                // COHORTES
                case 'crearcohorte': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !crearcohorte <nombre>' });
                    const res = crearCohorte(args, userId);
                    return sock.sendMessage(rawFrom, { text: res.msg });
                }

                case 'unirseco': {
                    if (!args) return sock.sendMessage(rawFrom, { text: '⚠️ Uso: !unirseco <id>' });
                    const res = unirseCohorte(userId, args);
                    return sock.sendMessage(rawFrom, { text: res.msg });
                }

                case 'salirco': {
                    const res = salirCohorte(userId);
                    return sock.sendMessage(rawFrom, { text: res.msg });
                }

                case 'miscohortes': {
                    const misCohort = Object.values(cohortes).filter(c => c.miembros.includes(userId));
                    if (misCohort.length === 0) return sock.sendMessage(rawFrom, { text: '⚠️ Sin cohortes' });
                    const cohortesInfo = misCohort.map(c => `${c.nombre} (${c.miembros.length}/5)\nID: ${c.id}`).join('\n\n');
                    return sock.sendMessage(rawFrom, { text: `🌑 Mis Cohortes:\n\n${cohortesInfo}` });
                }

                case 'vercohorte': {
                    const userCohorte = usuarios[userId]?.cohorte;
                    if (!userCohorte || !cohortes[userCohorte]) return sock.sendMessage(rawFrom, { text: '⚠️ No estás en cohorte' });
                    const c = cohortes[userCohorte];
                    const miembrosInfo = c.miembros.map(m => `@${m} - ${usuarios[m]?.nombre || 'Desconocido'} (${usuarios[m]?.rango})`).join('\n');
                    return sock.sendMessage(rawFrom, { 
                        text: `🌑 ${c.nombre}\n\n👑 Lider: @${c.lider}\n\nMiembros:\n${miembrosInfo}`,
                        mentions: [c.lider + '@s.whatsapp.net', ...c.miembros.map(m => m + '@s.whatsapp.net')]
                    });
                }

                default:
                    return;
            }

        } catch (error) {
            console.error('Error en mensaje:', error.message);
        }

    });
}

// Iniciar
start().catch(err => {
    console.log('Error fatal:', err);
    setTimeout(() => start(), 5000);
});