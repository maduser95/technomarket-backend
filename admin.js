const SERVER_URL = 'http://localhost:3000';
let editProductId = null;

// Получение токена из браузера — СТРОГО АДМИНСКОГО!
function getToken() { 
    // Админка должна работать только по ключу admin_token
    return localStorage.getItem('admin_token'); 
}

// 1. Генерация HTML-разметки экрана
window.getAdminHtml = function() {
    const token = getToken();

    // Если админ не авторизован — показываем чистую форму входа
    if (!token) {
        return `
            <div style="max-width: 400px; margin: 60px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); text-align: center; border: 1px solid #eaeaea;">
                <h2 style="margin-bottom: 20px; color: #222;">Вход в панель управления</h2>
                <form id="admin-login-form">
                    <div class="form-group" style="text-align: left;">
                        <label>Логин:</label>
                        <input type="text" id="login-username" value="admin" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; box-sizing: border-box;">
                    </div>
                    <div class="form-group" style="text-align: left; margin-top: 15px;">
                        <label>Пароль:</label>
                        <input type="password" id="login-password" placeholder="Введите пароль" required style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; box-sizing: border-box;">
                    </div>
                    <button type="submit" class="btn btn-blue" style="width: 100%; margin-top: 20px; padding: 12px; font-weight: 600; border-radius: 6px; background: #007bff; color: white; border: none; cursor: pointer;">Войти</button>
                </form>
            </div>
        `;
    }

    // Если авторизован — показываем CRM-панель
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h1>Панель администратора — ТехноМаркет</h1>
            <button onclick="adminLogout()" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Выйти из системы</button>
        </div>
        
        <h2 id="form-title">🛠 Добавление нового товара</h2>
        <form id="add-product-form" enctype="multipart/form-data">
            <div class="form-group"><label>Название техники:</label><input type="text" id="form-p-name" name="name" required></div>
            <div class="form-group"><label>Цена (руб):</label><input type="number" id="form-p-price" name="price" required></div>
            <div class="form-group"><label>Описание:</label><textarea id="form-p-desc" name="desc" rows="3"></textarea></div>
            <div class="form-group">
                <label id="image-label">Изображение товара:</label>
                <input type="file" id="form-p-image" name="productImage" accept="image/*">
                <small id="image-help" style="color: #666; display: none; margin-top: 5px;">Оставьте пустым, если не хотите менять картинку.</small>
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="submit" id="form-submit-btn" class="btn btn-blue">Загрузить на сайт</button>
                <button type="button" id="form-cancel-btn" class="btn" style="background: #6c757d; display: none;">Отмена</button>
            </div>
        </form>

        <h2>📦 Управление товарами</h2>
        <table>
            <thead><tr><th>Товар</th><th>Цена</th><th>Действия</th></tr></thead>
            <tbody id="products-table-body"></tbody>
        </table>
        <hr>
        <h2>📋 Управление заказами клиентов (Вся база CRM)</h2>
        <div id="orders-container"></div>
    `;
};
// 2. Инициализация интерактивной логики скрипта
window.initAdminLogic = function() {
    const loginForm = document.getElementById('admin-login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            try {
                const res = await fetch(SERVER_URL + '/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await res.json();
                if (result.success) {
                    localStorage.setItem('admin_token', result.token);
                    window.navigate('admin'); 
                } else { 
                    alert('❌ ' + result.message); 
                }
            } catch (err) { 
                alert('Ошибка соединения с сервером'); 
            }
        });
        return;
    }

    loadProductsInAdmin();
    loadOrdersInAdmin();

    const addProductForm = document.getElementById('add-product-form');
    const cancelBtn = document.getElementById('form-cancel-btn');

    function resetFormMode() {
        editProductId = null;
        if (addProductForm) addProductForm.reset();
        document.getElementById('form-title').innerText = '🛠 Добавление нового товара';
        document.getElementById('form-submit-btn').innerText = 'Загрузить на сайт';
        document.getElementById('form-p-image').required = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        document.getElementById('image-help').style.display = 'none';
    }

    if (cancelBtn) cancelBtn.addEventListener('click', resetFormMode);

    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const isEdit = editProductId !== null;
            const url = isEdit ? SERVER_URL + '/api/products/' + editProductId : SERVER_URL + '/api/products';

            try {
                const res = await fetch(url, { 
                    method: isEdit ? 'PUT' : 'POST', 
                    headers: { 'Authorization': 'Bearer ' + getToken() },
                    body: formData 
                });
                const result = await res.json();
                if (result.success) {
                    showAdminToast(isEdit ? 'Товар успешно обновлен!' : 'Товар успешно добавлен!');
                    resetFormMode();
                    loadProductsInAdmin();
                } else { 
                    alert(result.message); 
                }
            } catch (err) { 
                alert('Ошибка соединения с сервером'); 
            }
        });
    }
};

// Перевод формы в режим редактирования
window.startEditProduct = function(encodedProduct) {
    const product = JSON.parse(decodeURIComponent(atob(encodedProduct)));
    editProductId = product._id;
    document.getElementById('form-p-name').value = product.name;
    document.getElementById('form-p-price').value = product.price;
    document.getElementById('form-p-desc').value = product.desc || '';
    document.getElementById('form-title').innerText = '✏️ Редактирование: ' + product.name;
    document.getElementById('form-submit-btn').innerText = 'Сохранить изменения';
    document.getElementById('form-p-image').required = false;
    document.getElementById('form-cancel-btn').style.display = 'inline-block';
    document.getElementById('image-help').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Загрузка товаров из БД
async function loadProductsInAdmin() {
    try {
        const response = await fetch(SERVER_URL + '/api/products');
        const products = await response.json();
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = products.map(p => {
            const encodedData = btoa(encodeURIComponent(JSON.stringify(p)));
            return `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.price.toLocaleString('ru-RU')} руб.</td>
                    <td>
                        <button onclick="startEditProduct('${encodedData}')" style="color:#007bff; cursor:pointer; margin-right: 10px; background: none; border: none; font-weight: 600;">Редактировать</button>
                        <button onclick="adminDeleteProduct('${p._id}')" style="color:red; cursor:pointer; background: none; border: none; font-weight: 600;">Удалить</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error(err); }
}

// Удаление товара из базы
window.adminDeleteProduct = async function(id) {
    if (!confirm('Вы уверены, что хотите удалить товар?')) return;
    try {
        const res = await fetch(SERVER_URL + '/api/products/' + id, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        const result = await res.json();
        if (result.success) { 
            showAdminToast('Товар удален'); 
            loadProductsInAdmin(); 
        }
    } catch(err) { console.error(err); }
};

// Загрузка и рендеринг списка заказов (CRM)
async function loadOrdersInAdmin() {
    try {
        const response = await fetch(SERVER_URL + '/api/orders', {
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        const orders = await response.json();
        const container = document.getElementById('orders-container');
        if (!container) return;

        if (orders.length === 0) { 
            container.innerHTML = '<p style="color: #666;">Заказов пока нет.</p>'; 
            return; 
        }

        container.innerHTML = orders.map(order => {
            let statusClass = 'status-new';
            if (order.status === 'В обработке') statusClass = 'status-process';
            if (order.status === 'Выполнен') statusClass = 'status-done';
            if (order.status === 'Отменен') statusClass = 'status-cancel';

            const items = order.items.map(i => `<li>${i.name} — ${i.quantity} шт. x ${i.price.toLocaleString('ru-RU')} руб.</li>`).join('');
            
            return `
                <div class="order-card" style="border: 1px solid #ddd; padding: 20px; margin-bottom: 15px; border-radius: 6px; background: #fff;">
                    <div class="order-header">
                        <strong>Заказ от ${new Date(order.createdAt).toLocaleString('ru-RU')}</strong>
                        <span class="status-badge ${statusClass}">${order.status}</span>
                    </div>
                    <p style="margin: 10px 0 5px 0;"><strong>👤 Покупатель:</strong> ${order.clientName} (${order.clientPhone})</p>
                    <p style="margin: 0 0 10px 0;"><strong>🛒 Состав заказа:</strong></p>
                    <ul style="margin: 0 0 15px 20px; padding: 0;">${items}</ul>
                    <p style="margin-bottom: 15px;"><strong>💰 Итоговая сумма:</strong> <span style="font-size: 16px; color: #28a745; font-weight: bold;">${order.totalPrice.toLocaleString('ru-RU')} руб.</span></p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="adminChangeStatus('${order._id}', 'В обработке')" style="padding: 6px 12px; cursor:pointer;">⏳ В обработку</button>
                        <button onclick="adminChangeStatus('${order._id}', 'Выполнен')" style="padding: 6px 12px; cursor:pointer;">✅ Выполнен</button>
                        <button onclick="adminChangeStatus('${order._id}', 'Отменен')" style="padding: 6px 12px; cursor:pointer;">❌ Отменить</button>
                        <button onclick="adminChangeStatus('${order._id}', 'Удалить')" style="padding: 6px 12px; cursor:pointer; background: #dc3545; color: white; border: none; border-radius: 4px;">🗑 Удалить историю</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) { console.error(err); }
}

// Изменение статуса заказа
window.adminChangeStatus = async function(id, status) {
    if (status === 'Удалить' && !confirm('Удалить заказ из истории?')) return;
    try {
        const res = await fetch(SERVER_URL + '/api/orders/' + id, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getToken()
            },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (result.success) {
            showAdminToast(status === 'Удалить' ? 'Заказ удален' : 'Статус изменен на: ' + status);
            loadOrdersInAdmin();
        }
    } catch (err) { console.error(err); }
};

// Кнопка выхода из системы
window.adminLogout = function() {
    localStorage.removeItem('admin_token');
    window.navigate('admin');
};

// Функция всплывающих тостов
function showAdminToast(text) {
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerText = text;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
}
