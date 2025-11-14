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
        endpoints: ['/health', '/collections', '/collections/:name', '/login', '/register', '/roles', '/users/:id/role']
    });
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required',
                details: 'Please provide both email and password in the request body'
            });
        }

        // Find user by email in Firestore
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return res.status(401).json({ 
                error: 'Invalid credentials',
                details: 'No user found with this email'
            });
        }

        // Get user data
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Check password
        // Note: In production, passwords should be hashed (e.g., using bcrypt)
        // For now, we'll do a simple comparison
        if (userData.password !== password) {
            return res.status(401).json({ 
                error: 'Invalid credentials',
                details: 'Incorrect password'
            });
        }

        // Return user data without password
        const { password: _, ...userWithoutPassword } = userData;
        
        return res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: userDoc.id,
                ...userWithoutPassword
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ 
            error: 'Failed to process login', 
            details: err.message 
        });
    }
});

// Register endpoint
app.post('/register', async (req, res) => {
    try {
        const { email, password, name, address } = req.body;

        // Validate input
        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: 'Email, password, and name are required. Address is optional.'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format',
                details: 'Please provide a valid email address'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password too short',
                details: 'Password must be at least 6 characters long'
            });
        }

        // Check if email already exists
        const usersRef = db.collection('users');
        const emailCheck = await usersRef.where('email', '==', email).limit(1).get();

        if (!emailCheck.empty) {
            return res.status(409).json({ 
                error: 'Email already registered',
                details: 'A user with this email already exists'
            });
        }

        // Get the next user_id (find max user_id and add 1)
        const allUsers = await usersRef.get();
        let maxUserId = 0;
        allUsers.forEach(doc => {
            const userId = doc.data().user_id;
            if (userId && userId > maxUserId) {
                maxUserId = userId;
            }
        });
        const newUserId = maxUserId + 1;

        // Create new user object
        const newUser = {
            user_id: newUserId,
            email: email,
            password: password, // Note: In production, hash this password before storing
            name: name,
            address: address || '',
        };

        // Save to Firestore using user_id as document ID
        await usersRef.doc(String(newUserId)).set(newUser);

        // Return user data without password
        const { password: _, ...userWithoutPassword } = newUser;

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: String(newUserId),
                ...userWithoutPassword
            }
        });

    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ 
            error: 'Failed to register user', 
            details: err.message 
        });
    }
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