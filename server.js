const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const PORT = 3000;
const JWT_SECRET = 'super_secret_key_technomarket_2026';

// === НАСТРОЙКА ПОДКЛЮЧЕНИЯ К MONGO DB ===
const MONGO_URI = 'mongodb://test:test123@ac-shh0f36-shard-00-00.1x3b4jj.mongodb.net:27017,ac-shh0f36-shard-00-01.1x3b4jj.mongodb.net:27017,ac-shh0f36-shard-00-02.1x3b4jj.mongodb.net:27017/mybase?ssl=true&replicaSet=atlas-jjqhj1-shard-0&authSource=admin'; 



mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('🍃 Успешно подключено к базе данных MongoDB Atlas!');
        await seedAdmin();
    })
    .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// === СХЕМЫ И МОДЕЛИ ===
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    desc: { type: String, default: "Описание отсутствует" },
    img: { type: String, required: true },
    isLocalImg: { type: Boolean, default: false }
});
const Product = mongoose.model('Product', productSchema);

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);


const orderSchema = new mongoose.Schema({
    clientName: { type: String, required: true },
    clientPhone: { type: String, required: true },
    items: [
        {
            productId: { type: String },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true }
        }
    ],
    totalPrice: { type: Number, required: true },
    status: { type: String, default: "Новый" },
    userEmail: { type: String, default: "Гость" },   // <-- Добавили в схему БД
    accountName: { type: String, default: "Гость" }, // <-- Добавили в схему БД
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);




const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', adminSchema);

async function seedAdmin() {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('7777', 10);
            const defaultAdmin = new Admin({ username: 'admin', password: hashedPassword });
            await defaultAdmin.save();
            console.log('👤 Создана учетная запись админа (логин: admin, пароль: 7777)');
        }
    } catch (err) { console.error('Ошибка при создании админа:', err); }
}

// === НАСТРОЙКИ СЕРВЕРА ===
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});


app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadDir); },
    filename: (req, file, cb) => { 
        const fileExt = path.extname(file.originalname);
        cb(null, Date.now() + '-file' + fileExt); 
    }
});
const upload = multer({ storage: storage });

// Универсальный мидлвар защиты бэкенда (Супер-надежный парсинг)
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, message: "Доступ запрещен. Вы не авторизованы." });

    // Железное извлечение токена: убираем слово Bearer и зачищаем любые лишние пробелы
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token || token === "null" || token === "undefined") {
        return res.status(401).json({ success: false, message: "Токен отсутствует или невалиден." });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "Сессия устарела. Войдите заново." });
        
        req.adminId = null;
        req.userId = null;
        req.userRole = decoded.role || 'admin'; 

        if (req.userRole === 'user') {
            req.userId = decoded.id; 
        } else {
            req.adminId = decoded.id; 
        }
        next();
    });
}

// === API РОУТ ПОЛУЧЕНИЯ ЗАКАЗОВ ДЛЯ CRM И ЛИЧНОГО КАБИНЕТА (ИСПРАВЛЕННЫЙ) ===
app.get('/api/orders', verifyToken, async (req, res) => {
    try {
        // 1. ЖЕЛЕЗНАЯ ПРОВЕРКА НА АДМИНА: смотрим строго на роль в токене
        if (req.userRole === 'admin') {
            // Админу отдаем абсолютно ВСЕ заказы из базы данных для CRM панели
            const allOrders = await Order.find().sort({ createdAt: -1 });
            return res.json(allOrders);
        } 
        
        // 2. ЕСЛИ ЭТО ОБЫЧНЫЙ ПОЛЬЗОВАТЕЛЬ (роль 'user')
        if (req.userRole === 'user' && req.userId) {
            const user = await User.findById(req.userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "Пользователь не найден в системе." });
            }

            // Обычный покупатель видит строго ЕГО заказы
            const userOrders = await Order.find({
                $or: [
                    { userEmail: user.email },
                    { accountName: user.name }
                ]
            }).sort({ createdAt: -1 });

            return res.json(userOrders);
        }

        // Если токен валиден, но роль не определена
        return res.status(403).json({ success: false, message: "Доступ запрещен. Недостаточно прав." });

    } catch (error) { 
        console.error('Ошибка на роуте чтения заказов:', error);
        res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" }); 
    }
});



// === API РОУТЫ ===

// === 1. ИСПРАВЛЕННЫЙ РОУТ ЛОГИНА АДМИНА (Добавили роль в токен) ===
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(400).json({ success: false, message: "Неверный логин или пароль" });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Неверный логин или пароль" });

        // ВАЖНО: Зашиваем роль 'admin' прямо в JWT-токен, как у пользователей!
        const token = jwt.sign({ id: admin._id, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, message: "Вход выполнен!", token });
    } catch (err) { res.status(500).json({ success: false, message: "Ошибка сервера" }); }
});

// === АВТОРИЗАЦИЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ ===

// 1. Регистрация нового пользователя
app.post('/api/user/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Проверяем, занят ли email
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Пользователь с таким email уже зарегистрирован" });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем пользователя
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ success: true, message: "Регистрация успешна! Теперь вы можете войти." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Ошибка при регистрации" });
    }
});

// 2. Вход пользователя
app.post('/api/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Ищем пользователя
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, message: "Неверный email или пароль" });

        // Проверяем пароль
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Неверный email или пароль" });

        // Создаем токен (срок действия 7 дней)
        const token = jwt.sign({ id: user._id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ 
            success: true, 
            message: "Вход выполнен!", 
            token,
            user: { name: user.name, email: user.email } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Ошибка сервера при входе" });
    }
});


app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) { res.status(500).json({ message: "Ошибка сервера" }); }
});

app.post('/api/products', verifyToken, async (req, res) => {
    try {
        const { name, price, desc, img } = req.body; // <-- Добавили img сюда
let imageUrl = "/uploads/default.jpg";
let isLocalImg = false;

if (req.file) { 
    imageUrl = "/uploads/" + req.file.filename; 
    isLocalImg = true; 
} else if (img && img.trim() !== "") { // <-- Добавили проверку ссылки из интернета
    imageUrl = img.trim();
    isLocalImg = false;
}

        const newProduct = new Product({ name, price: Number(price), desc: desc || "Описание отсутствует", img: imageUrl, isLocalImg });
        await newProduct.save();
        res.status(201).json({ success: true, message: "Товар добавлен!" });
    } catch (error) { res.status(500).json({ success: false, message: "Ошибка бэкенда" }); }
});

app.delete('/api/products/:id', verifyToken, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Товар не найден" });

        if (product.isLocalImg && product.img) {
            try {
                const parts = product.img.split('/uploads/');
                if (parts.length > 1) {
                    const filePath = path.join(__dirname, 'uploads', parts[1]);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            } catch (err) { console.error(err); }
        }
        await Product.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: "Товар удален!" });
    } catch (error) { return res.status(500).json({ success: false, message: "Ошибка сервера" }); }
});

app.put('/api/products/:id', verifyToken, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Товар не найден" });

        product.name = req.body.name || product.name;
        product.price = req.body.price ? Number(req.body.price) : product.price;
        product.desc = req.body.desc || product.desc;

        if (req.file) {
            if (product.isLocalImg && product.img) {
                try {
                    const parts = product.img.split('/uploads/');
                    if (parts.length > 1) {
                        const oldFilePath = path.join(__dirname, 'uploads', parts[1]);
                        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
                    }
                } catch (err) { console.error(err); }
            }
      product.img = "/uploads/" + req.file.filename;
        product.isLocalImg = true;
    } else if (req.body.img && req.body.img.trim() !== "") { 
        product.img = req.body.img.trim();
        product.isLocalImg = false;
    }

    await product.save();

        res.json({ success: true, message: "Товар обновлен!" });
    } catch (error) { res.status(500).json({ success: false, message: "Ошибка сервера" }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { clientName, clientPhone, items, totalPrice, userEmail, accountName } = req.body;
        
        // Создаем объект заказа, берем переданные с фронтенда данные авторизации
        const newOrder = new Order({ 
            clientName, 
            clientPhone, 
            items, 
            totalPrice: Number(totalPrice),
            userEmail: userEmail || "Гость",      // Если гость — запишет "Гость"
            accountName: accountName || "Гость"   // Если гость — запишет "Гость"
        });
        
        await newOrder.save();
        res.status(201).json({ success: true, message: "Заказ успешно оформлен!" });
    } catch (error) { 
        console.error("Ошибка при создании заказа:", error);
        res.status(500).json({ success: false, message: "Ошибка сервера при создании заказа" }); 
    }
});




app.patch('/api/orders/:id', verifyToken, async (req, res) => {
    try {
        if (req.body.status === "Удалить") {
            await Order.findByIdAndDelete(req.params.id);
            return res.json({ success: true, message: "Заказ удален" });
        }
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Заказ не найден" });
        order.status = req.body.status || order.status;
        await order.save();
        res.json({ success: true, message: "Статус изменен" });
    } catch (error) { res.status(500).json({ success: false, message: "Ошибка сервера" }); }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер ТехноМаркета запущен на порту ${PORT}!`);
});
