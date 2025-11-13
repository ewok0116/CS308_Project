require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const admin = require('firebase-admin');

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
} else {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}

const db = admin.firestore();

app.get('/health', (req, res) => {
    return res.json({ status: 'ok' });
});

app.get('/collections', async (req, res) => {
    try {
        const firestore = admin.firestore();
        const collections = await firestore.listCollections();
        const names = collections.map((c) => c.id);
        return res.json({ collections: names });
    } catch (err) {
        console.error('Failed to list collections:', err);
        return res.status(500).json({ error: 'Failed to list collections' });
    }
});

app.get('/collections/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const firestore = admin.firestore();
        const snapshot = await firestore.collection(name).limit(20).get();
        const documents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        return res.json({ collection: name, count: documents.length, documents });
    } catch (err) {
        console.error(`Failed to read collection ${name}:`, err);
        return res.status(500).json({ error: `Failed to read collection ${name}` });
    }
});

app.get('/', (req, res) => {
    return res.json({
        message: 'Backend is running',
        endpoints: ['/health', '/collections', '/collections/:name']
    });
});

function getTokenFromHeader(req) {
    const h = req.header('Authorization') || '';
    if (!h.startsWith('Bearer ')) return null;
    return h.split(' ')[1];
}

async function authenticate(req, res, next) {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ error: 'Missing auth token' });
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = { uid: decoded.uid, claims: decoded };
        try {
            const doc = await db.collection('users').doc(decoded.uid).get();
            if (doc.exists) {
                req.user.role = doc.data().role || decoded.role || null;
            } else {
                req.user.role = decoded.role || null;
            }
        } catch (e) {
            req.user.role = decoded.role || null;
        }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid auth token', details: err.message });
    }
}

function authorize(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
        if (!allowedRoles.length) return next();
        if (allowedRoles.includes(req.user.role)) return next();
        return res.status(403).json({ error: 'Forbidden - insufficient role' });
    };
}

app.get('/roles', async (req, res) => {
    try {
        const rolesCol = await db.collection('roles').get();
        if (!rolesCol.empty) {
            const roles = rolesCol.docs.map(d => ({ id: d.id, ...d.data() }));
            return res.json({ roles });
        }
        const users = await db.collection('users').get();
        const set = new Set();
        users.forEach(d => {
            const r = d.data().role;
            if (r) set.add(r);
        });
        return res.json({ roles: Array.from(set) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to list roles', details: err.message });
    }
});

app.get('/users/:id/role', authenticate, authorize(['admin']), async (req, res) => {
    const uid = req.params.id;
    try {
        const doc = await db.collection('users').doc(uid).get();
        const role = doc.exists ? doc.data().role || null : null;
        return res.json({ uid, role });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to get user role', details: err.message });
    }
});

app.put('/users/:id/role', authenticate, authorize(['admin']), async (req, res) => {
    const uid = req.params.id;
    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: 'role is required in body' });
    try {
        await db.collection('users').doc(uid).set({ role }, { merge: true });
        await admin.auth().setCustomUserClaims(uid, { role });
        return res.json({ uid, role });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to set role', details: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});