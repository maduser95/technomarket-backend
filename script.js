const SERVER_URL = 'https://technomarket-api.onrender.com/';
let cart = JSON.parse(localStorage.getItem('fresh_cart')) || [];
let editProductId = null;

// ==========================================
// 1. УПРАВЛЕНИЕ ЭКРАНАМИ (МГНОВЕННЫЙ SPA-РОУТИНГ)
// ==========================================
window.switchPage = function(page) {
    // ПРОВЕРКА ДОСТУПА К КОРЗИНЕ
    if (page === 'cart') {
        const userToken = localStorage.getItem('user_token');
        const adminToken = localStorage.getItem('admin_token');
        
        // Если нет ни токена пользователя, ни токена админа — не пускаем
        if (!userToken && !adminToken) {
            showToast('🔒 Корзина доступна только зарегистрированным пользователям!');
            // Открываем модальное окно входа (если функция openAuthModal объявлена на странице)
            if (typeof openAuthModal === 'function') openAuthModal();
            return; // Прерываем переход в корзину
        }
    }

    // Скрываем все существующие разделы на странице
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    
    // Активируем нужный экран
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Управляем зоной входа: синяя кнопка должна отображаться ТОЛЬКО на главной (в каталоге)
    const authNavZone = document.getElementById('auth-nav-zone');
    if (authNavZone) {
        authNavZone.style.display = (page === 'catalog') ? 'block' : 'none';
    }

    // Принудительно обновляем навигационные права при каждом переходе
    updateAuthNavigation();

    // Запускаем рендеринг данных под конкретный экран
    if (page === 'catalog') renderCatalog();
    if (page === 'cart') initCartLogic();
    if (page === 'user-orders') loadUserOrders();
    if (page === 'admin') renderAdminScreen();
};

// ==========================================
// 2. УНИВЕРСАЛЬНАЯ СЛУЖБА КРАСИВЫХ ТОСТ-УВЕДОМЛЕНИЙ
// ==========================================
window.showToast = function(text) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<span>${text}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
};

// ==========================================
// 3. КАТАЛОГ ТОВАРОВ И КОРЗИНА ПОКУПАТЕЛЯ
// ==========================================
window.renderCatalog = async function() {
    const container = document.getElementById('catalog-container');
    if (!container) return;
    try {
        const response = await fetch(`${SERVER_URL}/api/products`);
        const products = await response.json();
        
        if (products.length === 0) {
            container.innerHTML = '<p style="color:#777; padding:20px 0;">Товаров пока нет в наличии.</p>';
            return;
        }

        container.innerHTML = `
            <style>
                .market-product-card {
                    background: white; padding: 20px; border-radius: 12px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.04); border: 1px solid #eee; 
                    display: flex; flex-direction: column; justify-content: space-between;
                    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
                    transition-property: transform, box-shadow, border-color !important;
                    cursor: pointer;
                }
                .market-product-card:hover {
                    transform: translateY(-8px) !important;
                    box-shadow: 0 12px 24px rgba(0, 123, 255, 0.15) !important;
                    border-color: #007bff !important;
                }
                .market-product-card:hover .product-img-anim {
                    transform: scale(1.05);
                }
            </style>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 25px; margin-top: 20px; padding: 10px 5px;">
                ${products.map(p => {
                    const encoded = btoa(encodeURIComponent(JSON.stringify(p)));
                    return `
                        <!-- Добавили вызов openProductDetailModal при клике на всю карту -->
                        <div class="market-product-card" onclick="openProductDetailModal('${encoded}')">
                            <div style="text-align: center; height: 160px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; overflow: hidden;">
                                <img src="${p.img}" class="product-img-anim" style="max-width:100%; max-height:100%; object-fit:contain; transition: transform 0.3s ease;" onerror="this.src='💻'">
                            </div>
                            <h3 style="font-size: 16px; font-weight: 600; color: #222; margin: 0 0 8px 0; min-height: 44px;">${p.name}</h3>
                            <p style="font-size:13px; color:#666; height:40px; overflow:hidden; margin: 0 0 15px 0; line-height: 1.4;">${p.desc || 'Без описания'}</p>
                            <div style="font-size: 18px; font-weight:bold; margin-bottom:15px; color: #2c3e50;">${p.price.toLocaleString()} ₽</div>
                            <!-- Используем event.stopPropagation(), чтобы клик по кнопке корзины не триггерил открытие модалки -->
                            <button class="btn-blue" onclick="event.stopPropagation(); addToCartComponent('${encoded}')" style="width: 100%; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">В корзину 🛒</button>
                        </div>`;
                }).join('')}
            </div>`;
    } catch (err) { 
        container.innerHTML = '<p style="color:red;">⚠️ Ошибка подключения к серверу.</p>'; 
    }
};




window.addToCartComponent = function(encoded) {
    const userToken = localStorage.getItem('user_token');
    const adminToken = localStorage.getItem('admin_token');

    // Если пользователь не залогинен — прерываем добавление
    if (!userToken && !adminToken) {
        showToast('🔑 Пожалуйста, войдите в аккаунт, чтобы добавлять товары в корзину!');
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
    }

    const product = JSON.parse(decodeURIComponent(atob(encoded)));
    const existing = cart.find(item => item._id === product._id);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart();
    showToast(`🛒 "${product.name}" успешно добавлен в корзину!`);
};

// Функция открытия детального модального окна товара с плавной анимацией взлета
window.openProductDetailModal = function(encoded) {
    const p = JSON.parse(decodeURIComponent(atob(encoded)));
    
    // Заполняем данные внутри окна
    document.getElementById('detail-modal-img').src = p.img || '💻';
    document.getElementById('detail-modal-name').innerText = p.name;
    document.getElementById('detail-modal-price').innerText = `${p.price.toLocaleString()} ₽`;
    document.getElementById('detail-modal-desc').innerText = p.desc || 'Описание товара отсутствует.';
    
    // Генерируем кнопку покупки внутрь модалки
    document.getElementById('detail-modal-action-zone').innerHTML = `
        <button class="btn-blue" onclick="closeProductDetailModal(); addToCartComponent('${encoded}')" style="width: 100%; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; background: #007bff; color: white; border: none; transition: background 0.2s;">Добавить в корзину 🛒</button>
    `;

    const modal = document.getElementById('product-detail-modal');
    const content = document.getElementById('product-detail-content');
    
    if (modal && content) {
        modal.style.display = 'flex';
        // Небольшой таймаут, чтобы браузер успел применить display: flex перед началом анимации
        setTimeout(() => {
            content.style.transform = 'scale(1)';
            content.style.opacity = '1';
        }, 10);
    }
};

// Функция плавного закрытия окна
window.closeProductDetailModal = function() {
    const modal = document.getElementById('product-detail-modal');
    const content = document.getElementById('product-detail-content');
    
    if (modal && content) {
        content.style.transform = 'scale(0.7)';
        content.style.opacity = '0';
        // Ждем окончания анимации (300мс) перед скрытием контейнера
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};

// Закрытие окна по клику на серую область вокруг карточки
document.addEventListener('click', (e) => {
    const modal = document.getElementById('product-detail-modal');
    if (e.target === modal) {
        closeProductDetailModal();
    }
});



function saveCart() {
    localStorage.setItem('fresh_cart', JSON.stringify(cart));
    const countBadge = document.getElementById('cart-count');
    if (countBadge) {
        countBadge.innerText = cart.reduce((sum, i) => sum + i.quantity, 0);
    }
}

window.initCartLogic = function() {
    const tbody = document.getElementById('cart-table-body');
    if (!tbody) return;
    tbody.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:25px; color:#888;">Ваша корзина пока пуста</td></tr>';
        document.getElementById('total-price-span').innerText = '0';
        return;
    }

    cart.forEach((item, index) => {
        const sum = item.price * item.quantity;
        total += sum;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.price.toLocaleString()} ₽</td>
            <td>${item.quantity} шт.</td>
            <td>${sum.toLocaleString()} ₽</td>
            <td><button onclick="removeCartItem(${index})" style="color:#ff4d4d; background:none; border:none; cursor:pointer; font-weight:bold;">Удалить ❌</button></td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('total-price-span').innerText = total.toLocaleString();
};

window.removeCartItem = function(index) {
    cart.splice(index, 1);
    saveCart();
    initCartLogic();
};

// ==========================================
// 4. ОФОРМЛЕНИЕ ЗАКАЗОВ КЛИЕНТАМИ (ИСПРАВЛЕНО)
// ==========================================
window.sendOrderToServer = async function(e) {
    e.preventDefault();
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    
    if (cart.length === 0) return alert('Ваша корзина пуста!');
    if (!name || !phone) return alert('Пожалуйста, заполните имя и телефон для доставки!');

    const currentUserEmail = localStorage.getItem('user_email') || "Гость";
    const currentUserName = localStorage.getItem('user_name') || "Гость";

    // Очищаем строку цены от любых пробелов, символов валюты и превращаем в число
    const priceText = document.getElementById('total-price-span').innerText;
    const cleanPrice = Number(priceText.replace(/[^0-9]/g, '')); 

    const orderData = {
        clientName: name, 
        clientPhone: phone,
        totalPrice: cleanPrice,
        items: cart.map(i => ({ productId: i._id, name: i.name, price: i.price, quantity: i.quantity })),
        userEmail: currentUserEmail,
        accountName: currentUserName 
    };

    try {
        const res = await fetch(`${SERVER_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        if (res.ok) {
            showToast('🎉 Заказ успешно оформлен! Оператор свяжется с вами.');
            cart = []; 
            saveCart(); 
            switchPage('catalog');
        } else {
            alert('Ошибка при сохранении заказа сервером');
        }
    } catch (err) { 
        alert('Ошибка соединения с сервером'); 
    }
};

// ==========================================
// 5. ЛЕНТА ЗАКАЗОВ В ЛИЧНОМ КАБИНЕТЕ ПОЛЬЗОВАТЕЛЯ (БЕЗОПАСНАЯ ВЕРСИЯ)
// ==========================================
window.loadUserOrders = async function() {
    const container = document.getElementById('user-orders-container');
    if (!container) return;

    const userToken = localStorage.getItem('user_token');

    if (!userToken) {
        container.innerHTML = "<p style='color:#666;'>Пожалуйста, авторизуйтесь для просмотра своих заказов.</p>";
        return;
    }

    try {
        const res = await fetch(`${SERVER_URL}/api/orders`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.status === 401 || res.status === 403) {
            container.innerHTML = "<p style='color: red;'>⚠️ Сессия устарела. Пожалуйста, войдите в аккаунт заново.</p>";
            return;
        }

        // Сервер теперь присылает ТОЛЬКО заказы этого конкретного пользователя!
        const userOrders = await res.json();

        if (userOrders.length === 0) {
            container.innerHTML = "<p style='color:#666; padding: 10px 0;'>Вы еще не совершали покупок под этим аккаунтом.</p>";
            return;
        }

        container.innerHTML = userOrders.map(o => {
            let statusColor = "#ffa500"; 
            if (o.status === 'Выполнен') statusColor = "#28a745"; 
            if (o.status === 'Отменен') statusColor = "#dc3545"; 

            return `
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); border: 1px solid #eee; font-family: sans-serif; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f5f5f5; padding-bottom: 8px;">
                        <span style="font-weight: bold; color: #555;">Заказ от ${new Date(o.createdAt).toLocaleDateString('ru-RU')}</span>
                        <span style="padding: 4px 10px; background: ${statusColor}; color: white; border-radius: 20px; font-size: 12px; font-weight: bold;">
                            ${o.status || 'Новый'}
                        </span>
                    </div>
                    <ul style="margin: 0 0 10px 20px; padding: 0; color: #333;">
                        ${o.items.map(i => `<li><strong>${i.name}</strong> — ${i.quantity} шт.</li>`).join('')}
                    </ul>
                    <div style="font-weight: bold; font-size: 15px; color: #2c3e50; text-align: right;">
                        Сумма заказа: ${o.totalPrice.toLocaleString()} ₽
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = "<p style='color: red;'>⚠️ Ошибка при подключении к API заказов.</p>";
    }
};


// ==========================================
// 6. ПАНЕЛЬ АДМИНИСТРАТОРА (CRM)
// ==========================================
window.renderAdminScreen = function() {
    const root = document.getElementById('admin-zone-root');
    if (!root) return;

    const adminToken = localStorage.getItem('admin_token');

    if (!adminToken) {
        root.innerHTML = `
            <div style="max-width: 400px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; box-shadow:0 4px 15px rgba(0,0,0,0.06); border: 1px solid #eee;">
                <h2 style="margin-top:0; margin-bottom:20px; text-align:center; color:#222;">🔑 Панель управления</h2>
                <form onsubmit="handleAdminLogin(event)">
                    <div class="form-group"><label>Логин:</label><input type="text" id="admin-user" value="admin" required></div>
                    <div class="form-group"><label>Пароль:</label><input type="password" id="admin-pass" required placeholder="Введите пароль"></div>
                    <button type="submit" class="btn-blue" style="margin-top:10px;">Войти в систему</button>
                </form>
            </div>`;
    } else {
        root.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; border-bottom:1px solid #eee; padding-bottom:15px;">
                <h2 style="margin:0;">🛠 Управление магазином (Админ-панель)</h2>
                <button onclick="adminLogout()" style="background:#dc3545; color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">Выйти из системы</button>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:25px;">
                <div class="admin-card">
                    <h3 id="form-title" style="margin-top:0;">Добавить новый товар</h3>
                    <form id="add-product-form" onsubmit="handleProductSubmit(event)">
                        <div class="form-group"><label>Название техники:</label><input type="text" id="prod-name" name="name" required></div>
                        <div class="form-group"><label>Цена (руб):</label><input type="number" id="prod-price" name="price" required></div>
                        <div class="form-group"><label>Описание товара:</label><textarea id="prod-desc" name="desc" rows="3"></textarea></div>
                        <div class="form-group"><label>Изображение (ссылка):</label><input type="text" id="prod-image" name="img" placeholder="http://..."></div>
                        <button type="submit" class="btn-green" id="form-submit-btn">Загрузить на сайт</button>
                    </form>
                </div>
                <div class="admin-card">
                    <h3 style="margin-top:0;">📦 Текущие товары в базе данных</h3>
                    <table>
                        <thead><tr><th>Товар</th><th>Цена</th><th>Действия</th></tr></thead>
                        <tbody id="admin-products-list"></tbody>
                    </table>
                </div>
            </div>
            <div class="admin-card" style="margin-top:25px;">
                <h3 style="margin-top:0;">📋 Заказы клиентов (CRM лента)</h3>
                <div id="orders-container"></div>
            </div>`;
        loadAdminProducts();
        loadAdminOrders();
    }
};

window.handleAdminLogin = async function(e) {
    e.preventDefault();
    const username = document.getElementById('admin-user').value;
    const password = document.getElementById('admin-pass').value;

    try {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await res.json();
        if (result.success) { 
            // Сохраняем чистый админский токен, сгенерированный роутом /api/auth/login
            localStorage.setItem('admin_token', result.token); 
            renderAdminScreen(); 
            updateAuthNavigation();
        } else {
            alert(result.message);
        }
    } catch (err) { 
        alert('Ошибка авторизации админа'); 
    }
};


window.adminLogout = function() { 
    localStorage.removeItem('admin_token'); 
    renderAdminScreen(); 
    updateAuthNavigation();
    switchPage('catalog');
};

async function loadAdminProducts() {
    const tbody = document.getElementById('admin-products-list');
    if (!tbody) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/products`);
        const products = await res.json();
        tbody.innerHTML = products.map(p => {
            const encoded = btoa(encodeURIComponent(JSON.stringify(p)));
            return `<tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.price.toLocaleString()} ₽</td>
                <td>
                    <button onclick="startEditProduct('${encoded}')" style="color:#ffa500; background:none; border:none; cursor:pointer; font-weight:bold; margin-right:10px;">Ред. ✏️</button>
                    <button onclick="deleteProduct('${p._id}')" style="color:#ff4d4d; background:none; border:none; cursor:pointer; font-weight:bold;">Удал. 🗑</button>
                </td>
            </tr>`;
        }).join('');
    } catch(e) { console.error(e); }
}
window.startEditProduct = function(encoded) {
    const p = JSON.parse(decodeURIComponent(atob(encoded)));
    editProductId = p._id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-desc').value = p.desc || "";
    document.getElementById('prod-image').value = p.img || "";
    document.getElementById('form-title').innerText = "✏️ Редактирование товара";
    document.getElementById('form-submit-btn').innerText = "Сохранить изменения 💾";
    document.getElementById('form-submit-btn').className = "btn-blue";
};

window.handleProductSubmit = async function(e) {
    e.preventDefault();
    const isEdit = editProductId !== null;
    const url = isEdit ? `${SERVER_URL}/api/products/${editProductId}` : `${SERVER_URL}/api/products`;

    // Собираем данные из текстовых полей формы админки
    const productData = {
        name: document.getElementById('prod-name').value.trim(),
        price: Number(document.getElementById('prod-price').value),
        desc: document.getElementById('prod-desc').value.trim(),
        img: document.getElementById('prod-image').value.trim() // Считываем ссылку на картинку
    };

    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify(productData)
        });

        if (res.ok) {
            showToast(isEdit ? '💾 Изменения успешно сохранены' : '✅ Новый товар добавлен в каталог');
            editProductId = null;
            e.target.reset();
            document.getElementById('form-title').innerText = "Добавить новый товар";
            document.getElementById('form-submit-btn').innerText = "Загрузить на сайт";
            document.getElementById('form-submit-btn').className = "btn-green";
            loadAdminProducts(); // Перезагружаем список в админке
            if (typeof renderCatalog === 'function') renderCatalog(); // Обновляем витрину
        } else {
            alert('Ошибка сервера при сохранении товара');
        }
    } catch(err) {
        alert('Ошибка при обработке товара');
    }
};



window.deleteProduct = async function(id) {
    if (!confirm('Вы уверены, что хотите окончательно удалить этот товар?')) return;
    try {
        await fetch(`${SERVER_URL}/api/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        showToast('🗑 Товар успешно удален из базы');
        loadAdminProducts();
    } catch(e) { console.error(e); }
};

async function loadAdminOrders() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    try {
        const res = await fetch(`${SERVER_URL}/api/orders`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = "Активных заказов нет.";
            return;
        }

        container.innerHTML = orders.map(o => `
            <div style="border:1px solid #eee; padding:15px; margin-top:10px; border-radius:8px; background:#fafafa; font-size:14px; font-family:sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong>📦 Заказ от ${new Date(o.createdAt).toLocaleString('ru-RU')}</strong>
                    <span style="padding:4px 8px; background:#e2e8f0; border-radius:4px; font-weight:bold; font-size:12px;">${o.status || 'Новый'}</span>
                </div>
                👤 Клиент: ${o.clientName} (Телефон: ${o.clientPhone})<br>
                🛒 Товары: <ul>${o.items.map(i => `<li>${i.name} — ${i.quantity} шт.</li>`).join('')}</ul>
                Итог к оплате: <strong style="color:#28a745;">${o.totalPrice.toLocaleString()} ₽</strong>
                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    <button onclick="adminChangeStatus('${o._id}', 'В обработке')" style="padding:4px 8px; cursor:pointer;">⏳ В обработку</button>
                    <button onclick="adminChangeStatus('${o._id}', 'Выполнен')" style="padding:4px 8px; cursor:pointer;">✅ Выполнен</button>
                    <button onclick="adminChangeStatus('${o._id}', 'Отменен')" style="padding:4px 8px; cursor:pointer;">❌ Отменить</button>
                    <button onclick="adminChangeStatus('${o._id}', 'Удалить')" style="padding:4px 8px; background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:auto;">🗑 Удалить историю</button>
                </div>
            </div>`).join('');
    } catch (e) { console.error(e); }
}

window.adminChangeStatus = async function(id, status) {
    if (status === 'Удалить' && !confirm('Удалить этот заказ из истории навсегда?')) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/orders/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (result.success) {
            showToast(status === 'Удалить' ? '🗑 Заказ удален из базы' : `⚙️ Статус изменен на: "${status}"`);
            loadAdminOrders();
        }
    } catch (err) { console.error(err); }
};
// ==========================================
// 7. АВТОРИЗАЦИЯ КЛИЕНТОВ И ИНИЦИАЛИЗАЦИЯ DOM
// ==========================================
window.updateAuthNavigation = function() {
    const zone = document.getElementById('auth-nav-zone');
    
    // 1. Контроль ссылки Админки
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) {
        const adminToken = localStorage.getItem('admin_token');
        adminLink.style.display = adminToken ? 'inline-block' : 'none';
    }

  
      // 2. Контроль ссылки "Мои заказы" покупателя (Упрощенная надежная версия)
    const ordersLink = document.getElementById('nav-user-orders-link');
    if (ordersLink) {
        const userToken = localStorage.getItem('user_token');
        
        // Показываем вкладку ВСЕМ, кто просто вошел в любой профиль на сайте
        if (userToken) {
            ordersLink.style.display = 'inline-block';
        } else {
            ordersLink.style.display = 'none';
        }
    }


    if (!zone) return;

    const token = localStorage.getItem('user_token');
    const name = localStorage.getItem('user_name');

    if (token && name) {
        zone.innerHTML = `
            <span style="font-size:14px; margin-right:10px; font-family:sans-serif;">👤 <strong>${name}</strong></span>
            <a onclick="userLogout()" style="color:#dc3545; cursor:pointer; text-decoration:underline; font-size:13px;">Выйти</a>`;
    } else {
        zone.innerHTML = `
            <button onclick="openAuthModal()" style="padding:8px 18px; background:#007bff; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:14px;">Войти</button>`;
    }
};

window.handleUserLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('auth-login-email').value;
    const password = document.getElementById('auth-login-password').value;
    const MY_ADMIN_EMAIL = "admin@technomarket.ru";

    // Защита: если админ пытается зайти через клиентскую форму, вежливо отправляем его в админку
    if (email.toLowerCase() === MY_ADMIN_EMAIL.toLowerCase()) {
        alert('🔑 Администраторам необходимо авторизоваться через панель управления!');
        closeAuthModal();
        switchPage('admin');
        return;
    }

    try {
        const res = await fetch(`${SERVER_URL}/api/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const r = await res.json();
        
        if (r.success) {
            localStorage.setItem('user_token', r.token); 
            localStorage.setItem('user_name', r.user.name);
            localStorage.setItem('user_email', r.user.email);
            
            closeAuthModal();
            showToast(`👋 Рады вас видеть, ${r.user.name}!`);

            updateAuthNavigation();
            switchPage('catalog');
        } else {
            alert(r.message);
        }
    } catch(err) { alert('Не удалось авторизоваться.'); }
};


window.handleUserRegister = async function(e) {
    e.preventDefault();
    const name = document.getElementById('auth-reg-name').value;
    const email = document.getElementById('auth-reg-email').value;
    const password = document.getElementById('auth-reg-password').value;

    try {
        const res = await fetch(`${SERVER_URL}/api/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const r = await res.json();
        
        if (r.success) { 
            showToast('🎉 Регистрация успешна! Теперь вы можете войти в профиль.'); 
            switchAuthTab('login'); 
            e.target.reset();
        } else {
            alert(r.message);
        }
    } catch(err) { alert('Ошибка при регистрации учетной записи.'); }
};

window.userLogout = function() { 
    localStorage.removeItem('user_token'); 
    localStorage.removeItem('user_name'); 
    localStorage.removeItem('user_email');
    localStorage.removeItem('admin_token'); // зачищаем и админский доступ при общем выходе
    updateAuthNavigation(); 
    showToast('🔒 Вы успешно вышли из профиля');
    switchPage('catalog');
};

document.addEventListener("DOMContentLoaded", () => {
    saveCart();
    renderCatalog();
    updateAuthNavigation();
});
