const CATALOG_SERVER_URL = 'http://localhost:3000';

window.renderCatalog = async function() {
    const container = document.getElementById('catalog-container');
    if (!container) return;

    try {
        const response = await fetch(`${CATALOG_SERVER_URL}/api/products`);
        const products = await response.json();
        
        if (products.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; font-size: 18px; padding: 40px 0;">Товаров пока нет в наличии.</p>';
            return;
        }

                container.innerHTML = `
            <!-- Этот глобальный стиль принудительно заставит ВСЕ карточки двигаться -->
            <style>
                .product-card {
                    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
                    transition-property: transform, box-shadow, border-color !important;
                    cursor: pointer;
                }
                .product-card:hover {
                    transform: translateY(-10px) !important;
                    box-shadow: 0 12px 25px rgba(0, 123, 255, 0.15) !important;
                    border-color: #007bff !important;
                    z-index: 10;
                }
                .product-card:hover .product-img {
                    transform: scale(1.05) !important;
                }
                .buy-btn {
                    transition: all 0.2s ease !important;
                }
                .buy-btn:hover {
                    background: #0056b3 !important;
                    box-shadow: 0 6px 15px rgba(0,123,255,0.4) !important;
                }
            </style>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 25px; margin-top: 25px; padding: 15px 5px;">
                ${products.map(p => {
                    const imgSrc = p.img.startsWith('http') ? p.img : `${CATALOG_SERVER_URL}${p.img}`;
                    const encodedData = btoa(encodeURIComponent(JSON.stringify(p)));

                    return `
                        <div class="product-card" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #eaeaea; text-align: left; position: relative;">
                            <div style="background: #fdfdfd; padding: 20px; display: flex; align-items: center; justify-content: center; height: 180px; border-bottom: 1px solid #f5f5f5; overflow: hidden;">
                                <img src="${imgSrc}" class="product-img" style="max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.3s ease;" onerror="this.src='💻'">
                            </div>
                            <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #222; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 50px;">${p.name}</h3>
                                    <p style="color: #777; font-size: 13px; line-height: 1.5; margin: 0 0 15px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; height: 58px;">${p.desc}</p>
                                </div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #f9f9f9;">
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Цена</span>
                                        <span style="font-size: 19px; color: #2c3e50; font-weight: 700; white-space: nowrap;">${p.price.toLocaleString('ru-RU')} ₽</span>
                                    </div>
                                    <button onclick="addToCartComponent('${encodedData}')" class="buy-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;">Купить</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

    } catch (err) {
        container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">⚠️ Не удалось загрузить товары.</p>';
    }
};



window.addToCartComponent = function(encodedProduct) {
    const product = JSON.parse(decodeURIComponent(atob(encodedProduct)));
    let localCart = JSON.parse(localStorage.getItem('cart')) || [];
    
    const existing = localCart.find(item => item._id === product._id);
    if (existing) { existing.quantity += 1; } else { localCart.push({ _id: product._id, name: product.name, price: product.price, quantity: 1 }); }
    
    localStorage.setItem('cart', JSON.stringify(localCart));
    
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerText = `Товар добавлен: ${product.name}`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
    if (typeof cart !== 'undefined') cart = localCart;
};
