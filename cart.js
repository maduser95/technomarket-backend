let cart = JSON.parse(localStorage.getItem('cart')) || [];
let finalPrice = 0;

window.getCartHtml = function() {
    return `
        <h1>🛒 Ваша корзина</h1>
        <table>
            <thead>
                <tr><th>Продукт</th><th>Цена</th><th>Количество</th><th>Сумма</th><th>Действие</th></tr>
            </thead>
            <tbody id="cart-table-body"></tbody>
        </table>
        <h3>Итого к оплате: <span id="total-price-span">0</span> руб.</h3>
        <div class="discount-box">🔥 Скидка нового клиента: <strong>5%</strong> | Экономия: <span id="discount-amount">0</span> руб.</div>
        <h2>📋 Данные для доставки</h2>
        <div class="form-group"><label>Ваше имя:</label><input type="text" id="client-name" placeholder="Имя"></div>
        <div class="form-group"><label>Номер телефона:</label><input type="tel" id="client-phone" placeholder="+7..."></div>
        <button class="btn" id="confirm-order-btn">Подтвердить заказ</button>
    `;
};

window.initCartLogic = function() {
    const tbody = document.getElementById('cart-table-body');
    if (!tbody) return;
    let rawTotal = 0;

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Ваша корзина пуста</td></tr>';
        document.getElementById('total-price-span').innerText = '0';
        document.getElementById('discount-amount').innerText = '0';
        return;
    }

    cart.forEach((item, index) => {
        const itemSum = item.price * item.quantity;
        rawTotal += itemSum;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td><td>${item.price} руб.</td><td>${item.quantity}</td><td>${itemSum} руб.</td>
            <td><button onclick="removeComponentItem(${index})" style="color:red; cursor:pointer; background:none; border:none; font-weight:600;">Удалить</button></td>
        `;
        tbody.appendChild(tr);
    });

    const discount = Math.round(rawTotal * 0.05);
    finalPrice = rawTotal - discount;
    document.getElementById('discount-amount').innerText = discount;
    document.getElementById('total-price-span').innerText = finalPrice;

    document.getElementById('confirm-order-btn').addEventListener('click', sendOrderToServer);
};

window.removeComponentItem = function(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    window.navigate('cart');
};

async function sendOrderToServer() {
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();

    if (!name || !phone || cart.length === 0) { alert('Заполните поля!'); return; }

    const orderData = {
        clientName: name, clientPhone: phone, totalPrice: finalPrice,
        items: cart.map(i => ({ productId: i._id || "", name: i.name, price: Number(i.price), quantity: Number(i.quantity) }))
    };

    try {
        const res = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await res.json();
        if (result.success) {
            const toastContainer = document.getElementById('toast-container');
            if (toastContainer) {
                const toast = document.createElement('div');
                toast.className = 'toast-notification';
                toast.innerText = '🎉 Заказ успешно оформлен!';
                toastContainer.appendChild(toast);
                setTimeout(() => toast.remove(), 2500);
            }
            cart = []; localStorage.removeItem('cart');
            window.navigate('catalog');
        }
    } catch (err) { alert('Ошибка соединения с сервером'); }
}
