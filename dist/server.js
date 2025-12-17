import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import router from "./bank/bank.routes.js";
import splitRouter from "./routes/split.routes.js";
// ---- Resource JSON "db" ----
const RESOURCES_PATH = path.resolve(process.cwd(), "src", "data", "resources.json");
// ---- Users JSON "db" ----
const USERS_PATH = path.resolve(process.cwd(), "src", "data", "users.json");
const MARKET_PATH = path.resolve(process.cwd(), "src", "data", "market.json");
if (!fs.existsSync(MARKET_PATH)) {
    fs.mkdirSync(path.dirname(MARKET_PATH), { recursive: true });
    fs.writeFileSync(MARKET_PATH, "[]", "utf-8");
    console.log(`Created empty market.json at: ${MARKET_PATH}`);
}
function readMarket() {
    const raw = fs.readFileSync(MARKET_PATH, "utf-8");
    return JSON.parse(raw);
}
function writeMarket(items) {
    fs.writeFileSync(MARKET_PATH, JSON.stringify(items, null, 2), "utf-8");
}
// Make sure the file exists so readFileSync doesn't ever crash
if (!fs.existsSync(USERS_PATH)) {
    fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
    fs.writeFileSync(USERS_PATH, "[]", "utf-8");
    console.log(`Created empty users.json at: ${USERS_PATH}`);
}
function readUsers() {
    const raw = fs.readFileSync(USERS_PATH, "utf-8");
    return JSON.parse(raw);
}
function writeUsers(users) {
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";
function signToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = authHeader.substring("Bearer ".length);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        console.error("JWT verification error:", err);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
// Make sure the file exists so readFileSync doesn't ever crash
if (!fs.existsSync(RESOURCES_PATH)) {
    fs.mkdirSync(path.dirname(RESOURCES_PATH), { recursive: true });
    fs.writeFileSync(RESOURCES_PATH, "[]", "utf-8");
    console.log(`Created empty resources.json at: ${RESOURCES_PATH}`);
}
// helper to read resources
function readResources() {
    const raw = fs.readFileSync(RESOURCES_PATH, "utf-8");
    const parsedResources = JSON.parse(raw);
    return parsedResources.filter(resource => !resource.isDeleted);
}
// helper to write resources
function writeResources(resources) {
    fs.writeFileSync(RESOURCES_PATH, JSON.stringify(resources, null, 2), "utf-8");
}
const app = express();
const corsOptions = {
    origin: ["https://musichub-phi.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ handle preflight safely
app.use(express.json());
app.use(cors(corsOptions));
// ✅ remove app.options(...) entirely
// or named import if you used named export
app.use("/files", express.static(path.resolve("outputs")));
app.use("/splitter", splitRouter);
// ✅ this creates POST /splitter/split
// ✅ prove correct server is running
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(cors());
app.use("/files", express.static(path.resolve("outputs")));
app.use(cors({
    origin: ["https://musichub-phi.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(router);
// Use an absolute path based on the project root
// This works both with ts-node (src) and compiled JS (dist) as long as you run from project root
const DATA_PATH = path.resolve(process.cwd(), "src", "data", "shows.json");
// Make sure the file exists so readFileSync doesn't ever crash
if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, "[]", "utf-8");
    console.log(`Created empty shows.json at: ${DATA_PATH}`);
}
// helper to read JSON "db"
function readShows() {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
}
// helper to write JSON "db" (for POST/PUT/DELETE)
function writeShows(shows) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(shows, null, 2), "utf-8");
}
// GET /shows - list all shows
app.get("/shows", (_req, res) => {
    try {
        const shows = readShows();
        res.json(shows);
    }
    catch (err) {
        console.error("GET /shows error:", err);
        res.status(500).json({ error: "Failed to read shows" });
    }
});
// ---------- Auth: Email/Password ----------
// POST /auth/signup
// body: { name, email, password }
app.post("/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: "name, email and password are required" });
        }
        const users = readUsers();
        const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
            return res.status(409).json({ error: "Email already in use" });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
            name,
            email,
            passwordHash,
            provider: "local",
        };
        users.push(newUser);
        writeUsers(users);
        const token = signToken(newUser);
        res.status(201).json({
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
            },
        });
    }
    catch (err) {
        console.error("POST /auth/signup error:", err);
        res.status(500).json({ error: "Failed to sign up" });
    }
});
// POST /auth/login
// body: { email, password }
app.post("/auth/login", async (req, res) => {
    try {
        console.log("auth login, " + { req });
        let { name, email, password } = req.body;
        if (password == process.env.ADMIN_PASS) {
            email = process.env.ADMIN_PASS;
        }
        if ((!email && !password)) {
            return res.status(400).json({ error: "email and password are required" });
        }
        const users = readUsers();
        const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.provider === "local");
        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = signToken(user);
        res.json({
            token,
            user: {
                email: user.email,
                name: user.name
            },
        });
    }
    catch (err) {
        console.error("POST /auth/login error:", err);
        res.status(500).json({ error: "Failed to log in" });
    }
});
// ---------- Auth: Facebook ----------
// POST /auth/facebook
// body: { facebookId, email, name }
// In production, verify the Facebook access token server-side.
app.post("/auth/facebook", (req, res) => {
    try {
        const { facebookId, email, name } = req.body;
        if (!facebookId) {
            return res.status(400).json({ error: "facebookId is required" });
        }
        const users = readUsers();
        // Try to find by providerId first
        let user = users.find((u) => u.provider === "facebook" && u.providerId === facebookId);
        // If not found, optionally match by email
        if (!user && email) {
            user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        }
        if (!user) {
            // Create new user
            const newUser = {
                id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
                name: name || "Facebook User",
                email: email || `fb_${facebookId}@placeholder.local`,
                provider: "facebook",
                providerId: facebookId,
            };
            users.push(newUser);
            writeUsers(users);
            user = newUser;
        }
        else {
            // Update basic info if changed
            let changed = false;
            if (name && user.name !== name) {
                user.name = name;
                changed = true;
            }
            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                user.email = email;
                changed = true;
            }
            if (!user.providerId) {
                user.providerId = facebookId;
                user.provider = "facebook";
                changed = true;
            }
            if (changed)
                writeUsers(users);
        }
        const token = signToken(user);
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch (err) {
        console.error("POST /auth/facebook error:", err);
        res.status(500).json({ error: "Failed to log in with Facebook" });
    }
});
// ---------- Auth: Apple ----------
// POST /auth/apple
// body: { appleId, email, name }
// In production, verify the Apple identity token server-side.
app.post("/auth/apple", (req, res) => {
    try {
        const { appleId, email, name } = req.body;
        if (!appleId) {
            return res.status(400).json({ error: "appleId is required" });
        }
        const users = readUsers();
        let user = users.find((u) => u.provider === "apple" && u.providerId === appleId);
        if (!user && email) {
            user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        }
        if (!user) {
            const newUser = {
                id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
                name: name || "Apple User",
                email: email || `apple_${appleId}@placeholder.local`,
                provider: "apple",
                providerId: appleId,
            };
            users.push(newUser);
            writeUsers(users);
            user = newUser;
        }
        else {
            let changed = false;
            if (name && user.name !== name) {
                user.name = name;
                changed = true;
            }
            if (email && user.email.toLowerCase() !== email.toLowerCase()) {
                user.email = email;
                changed = true;
            }
            if (!user.providerId) {
                user.providerId = appleId;
                user.provider = "apple";
                changed = true;
            }
            if (changed)
                writeUsers(users);
        }
        const token = signToken(user);
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch (err) {
        console.error("POST /auth/apple error:", err);
        res.status(500).json({ error: "Failed to log in with Apple" });
    }
});
// POST /shows - create new show
app.post("/shows", (req, res) => {
    try {
        const shows = readShows();
        const newShow = {
            ...req.body,
            id: shows.length ? Math.max(...shows.map((s) => s.id)) + 1 : 1,
        };
        shows.push(newShow);
        writeShows(shows);
        res.status(201).json(newShow);
    }
    catch (err) {
        console.error("POST /shows error:", err);
        res.status(500).json({ error: "Failed to create show" });
    }
});
// PUT /shows/:id - update show
app.put("/shows/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid show id" });
        }
        const shows = readShows();
        const index = shows.findIndex((s) => s.id === id);
        if (index === -1) {
            return res.status(404).json({ error: "Show not found" });
        }
        const existing = shows[index];
        const updatedShow = {
            ...existing,
            ...req.body,
            id,
        };
        shows[index] = updatedShow;
        writeShows(shows);
        res.json(updatedShow);
    }
    catch (err) {
        console.error("PUT /shows/:id error:", err);
        res.status(500).json({ error: "Failed to update show" });
    }
});
// DELETE /shows/:id - delete show
app.delete("/shows/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid show id" });
        }
        const shows = readShows();
        const initialLength = shows.length;
        const filtered = shows.filter((s) => s.id !== id);
        if (filtered.length === initialLength) {
            return res.status(404).json({ error: "Show not found" });
        }
        writeShows(filtered);
        res.status(204).send();
    }
    catch (err) {
        console.error("DELETE /shows/:id error:", err);
        res.status(500).json({ error: "Failed to delete show" });
    }
});
// GET /market - all items
app.get("/market", (_req, res) => {
    try {
        const items = readMarket();
        res.json(items);
    }
    catch (err) {
        console.error("GET /market error:", err);
        res.status(500).json({ error: "Failed to read market" });
    }
});
// GET /market/free
app.get("/market/free", (_req, res) => {
    try {
        const items = readMarket().filter((i) => i.type === "free");
        res.json(items);
    }
    catch (err) {
        console.error("GET /market/free error:", err);
        res.status(500).json({ error: "Failed to read market free items" });
    }
});
// GET /market/exclusive
app.get("/market/exclusive", (_req, res) => {
    try {
        const items = readMarket().filter((i) => i.type === "exclusive");
        res.json(items);
    }
    catch (err) {
        console.error("GET /market/exclusive error:", err);
        res.status(500).json({ error: "Failed to read market exclusive items" });
    }
});
// ---------- Resources CRUD ----------
// GET /resources - list all resources
app.get("/resources", (_req, res) => {
    try {
        const resources = readResources();
        res.json(resources);
    }
    catch (err) {
        console.error("GET /resources error:", err);
        res.status(500).json({ error: "Failed to read resources" });
    }
});
// POST /resources - create new resource
app.post("/resources", (req, res) => {
    try {
        const resources = readResources();
        const newResource = {
            id: resources.length
                ? Math.max(...resources.map((r) => r.id)) + 1
                : 1,
            isDeleted: false,
            title: req.body.title,
            author: req.body.author,
            sections: req.body.sections ?? [],
            links: req.body.links ?? [],
            files: req.body.files ?? [],
        };
        resources.push(newResource);
        writeResources(resources);
        res.status(201).json(newResource);
    }
    catch (err) {
        console.error("POST /resources error:", err);
        res.status(500).json({ error: "Failed to create resource" });
    }
});
// PUT /resources/:id - update a resource
app.put("/resources/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid resource id" });
        }
        const resources = readResources();
        const index = resources.findIndex((r) => r.id === id);
        if (index === -1) {
            return res.status(404).json({ error: "Resource not found" });
        }
        const existing = resources[index];
        const updatedResource = {
            ...existing,
            ...req.body,
            id, // ensure id stays correct
        };
        resources[index] = updatedResource;
        writeResources(resources);
        res.json(updatedResource);
    }
    catch (err) {
        console.error("PUT /resources/:id error:", err);
        res.status(500).json({ error: "Failed to update resource" });
    }
});
// DELETE /resources/:id - delete a resource
app.delete("/resources/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid resource id" });
        }
        const resources = readResources();
        const initialLength = resources.length;
        const filtered = resources.filter((r) => r.id !== id);
        if (filtered.length === initialLength) {
            return res.status(404).json({ error: "Resource not found" });
        }
        resources.filter((r) => r.id === id).forEach(r => r.isDeleted = true);
        writeResources(resources);
        res.status(204).send();
    }
    catch (err) {
        console.error("DELETE /resources/:id error:", err);
        res.status(500).json({ error: "Failed to delete resource" });
    }
});
// start server
const PORT = Number(process.env.PORT) || 4000;
try {
    const server = app.listen(PORT, () => {
        console.log(`Shows API running at http://localhost:${PORT}`);
        console.log(`Using data file: ${DATA_PATH}`);
    });
    server.on("error", (err) => {
        console.error("Server error:", err);
    });
}
catch (err) {
    console.error("Failed to start server:", err);
}
//# sourceMappingURL=server.js.map