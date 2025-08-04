document.addEventListener('DOMContentLoaded', () => {
    const avatarContainer = document.getElementById('avatarContainer');
    const searchInput = document.getElementById('searchInput');
    const rarityFilter = document.getElementById('rarityFilter');
    const attributeFilter = document.getElementById('attributeFilter');
    const ownershipFilter = document.getElementById('ownershipFilter');
    const ownedCountSpan = document.getElementById('ownedCount');
    const totalCountSpan = document.getElementById('totalCount');

    let allAvatars = [];
    let ownedAvatars = new Set();

    const RARITY_ORDER = { 'L': 0, 'E': 1, 'R': 2, 'U': 3 };
    const ATTRIBUTE_ORDER = {
        'fire': 0, 'water': 1, 'tree': 2, 'thunder': 3, 'light': 4, 'dark': 5
    };

    async function initializeAvatars() {
        try {
            const response = await fetch('avatars.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allAvatars = await response.json();

            allAvatars.sort((a, b) => {
                const rarityDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
                if (rarityDiff !== 0) return rarityDiff;
                return ATTRIBUTE_ORDER[a.attribute] - ATTRIBUTE_ORDER[b.attribute];
            });

            loadOwnedAvatars();
            updateAvatarDisplay();
        } catch (error) {
            console.error('Failed to load avatars:', error);
            avatarContainer.innerHTML = '<p style="text-align: center; color: red;">アバターデータの読み込みに失敗しました。</p>';
            postHeightMessage();
        }
    }

    function updateAvatarDisplay() {
        const searchText = searchInput.value.toLowerCase();
        const selectedRarity = rarityFilter.value;
        const selectedAttribute = attributeFilter.value;
        const selectedOwnership = ownershipFilter.value;

        const filteredAvatars = allAvatars.filter(avatar => {
            if (searchText && !avatar.name_ja.toLowerCase().includes(searchText)) {
                return false;
            }
            if (selectedRarity !== 'all' && avatar.rarity !== selectedRarity) {
                return false;
            }
            if (selectedAttribute !== 'all' && avatar.attribute !== selectedAttribute) {
                return false;
            }
            const isOwned = ownedAvatars.has(avatar.id);
            if (selectedOwnership === 'owned' && !isOwned) {
                return false;
            }
            if (selectedOwnership === 'not-owned' && isOwned) {
                return false;
            }
            return true;
        });

        renderAvatars(filteredAvatars);
        updateCounts(filteredAvatars.length);
    }

    function renderAvatars(avatarsToRender) {
        avatarContainer.innerHTML = '';

        if (avatarsToRender.length === 0) {
            avatarContainer.innerHTML = '<p style="text-align: center; color: #777;">条件に合うアバターが見つかりませんでした。</p>';
            postHeightMessage();
            return;
        }

        let currentRarity = null;
        let currentAttribute = null;

        let currentRarityGroup;
        let currentAttributeGroup;

        avatarsToRender.forEach(avatar => {
            if (currentRarity !== avatar.rarity) {
                currentRarity = avatar.rarity;
                currentAttribute = null;

                const rarityGroupContainer = document.createElement('div');
                rarityGroupContainer.className = 'rarity-group-container';
                avatarContainer.appendChild(rarityGroupContainer);
                currentRarityGroup = rarityGroupContainer;

                const rarityHeading = document.createElement('h2');
                rarityHeading.className = 'rarity-heading';
                rarityHeading.textContent = `【${avatar.rarity} レアリティ】`;
                currentRarityGroup.appendChild(rarityHeading);
            }

            if (currentAttribute !== avatar.attribute) {
                currentAttribute = avatar.attribute;

                const attributeGroupContainer = document.createElement('div');
                attributeGroupContainer.className = 'attribute-group-container';
                currentRarityGroup.appendChild(attributeGroupContainer);
                currentAttributeGroup = attributeGroupContainer;

                const attributeHeading = document.createElement('h3');
                attributeHeading.className = 'attribute-heading';
                attributeHeading.textContent = `-- ${getAttributeName(avatar.attribute)}属性 --`;
                currentAttributeGroup.appendChild(attributeHeading);

                const newAvatarGrid = document.createElement('div');
                newAvatarGrid.className = 'avatar-grid';
                currentAttributeGroup.appendChild(newAvatarGrid);
            }

            const avatarGrid = currentAttributeGroup.querySelector('.avatar-grid');
            if (avatarGrid) {
                const avatarItem = document.createElement('div');
                avatarItem.className = 'avatar-item';
                avatarItem.dataset.id = avatar.id;
                avatarItem.dataset.rarity = avatar.rarity;
                avatarItem.dataset.attribute = avatar.attribute;

                if (ownedAvatars.has(avatar.id)) {
                    avatarItem.classList.add('owned');
                }

                avatarItem.innerHTML = `
                    <img src="./images/${avatar.filename}" alt="${avatar.name_ja}">
                    <p>${avatar.name_ja}</p>
                    <div class="avatar-meta">
                        <span>${avatar.rarity}</span> | <span>${getAttributeName(avatar.attribute)}</span>
                    </div>
                `;

                avatarItem.addEventListener('click', () => toggleOwnership(avatar.id, avatarItem));
                avatarGrid.appendChild(avatarItem);
            }
        });

        // ⭐ 修正ポイント: 描画が完了した後に高さを親ページに通知
        // 画像の読み込みも待ってから高さを送信するロジックを追加
        const images = avatarContainer.querySelectorAll('img');
        let imagesLoaded = 0;
        const totalImages = images.length;
    
        if (totalImages === 0) {
            postHeightMessage();
        } else {
            images.forEach(img => {
                const imageLoaded = () => {
                    imagesLoaded++;
                    if (imagesLoaded === totalImages) {
                        postHeightMessage();
                    }
                };
                img.addEventListener('load', imageLoaded);
                img.addEventListener('error', imageLoaded); // エラー時もカウント
                if (img.complete) {
                    imageLoaded(); // キャッシュされている場合は即座に実行
                }
            });
        }
    }

    function toggleOwnership(avatarId, avatarItemElement) {
        if (ownedAvatars.has(avatarId)) {
            ownedAvatars.delete(avatarId);
            avatarItemElement.classList.remove('owned');
        } else {
            ownedAvatars.add(avatarId);
            avatarItemElement.classList.add('owned');
        }
        saveOwnedAvatars();
        updateCounts();

        avatarItemElement.classList.add('gray-effect');
        setTimeout(() => {
            avatarItemElement.classList.remove('gray-effect');
        }, 150);
    }

    function saveOwnedAvatars() {
        localStorage.setItem('ownedAvatars', JSON.stringify(Array.from(ownedAvatars)));
    }

    function loadOwnedAvatars() {
        const saved = localStorage.getItem('ownedAvatars');
        if (saved) {
            ownedAvatars = new Set(JSON.parse(saved));
        }
    }

    function updateCounts(displayedCount = allAvatars.length) {
        let currentOwnedDisplayed = 0;
        allAvatars.filter(avatar => {
            const searchText = searchInput.value.toLowerCase();
            const selectedRarity = rarityFilter.value;
            const selectedAttribute = attributeFilter.value;
            const isOwned = ownedAvatars.has(avatar.id);
            if (searchText && !avatar.name_ja.toLowerCase().includes(searchText)) return false;
            if (selectedRarity !== 'all' && avatar.rarity !== selectedRarity) return false;
            if (selectedAttribute !== 'all' && avatar.attribute !== selectedAttribute) return false;
            return isOwned;
        }).forEach(() => currentOwnedDisplayed++);

        ownedCountSpan.textContent = currentOwnedDisplayed;
        totalCountSpan.textContent = displayedCount;
    }

    function getAttributeName(attributeKey) {
        const attributeMap = {
            'fire': '炎',
            'water': '水',
            'tree': '樹',
            'thunder': '雷',
            'light': '光',
            'dark': '闇'
        };
        return attributeMap[attributeKey] || attributeKey;
    }

    // イベントリスナーの設定
    searchInput.addEventListener('input', updateAvatarDisplay);
    rarityFilter.addEventListener('change', updateAvatarDisplay);
    attributeFilter.addEventListener('change', updateAvatarDisplay);
    ownershipFilter.addEventListener('change', updateAvatarDisplay);

    initializeAvatars();

    function postHeightMessage() {
        if (window.parent) {
            const docHeight = document.documentElement.scrollHeight;
            window.parent.postMessage({
                height: docHeight
            }, 'https://sthenoskallos.com');
        }
    }
});