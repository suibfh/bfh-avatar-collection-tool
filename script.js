document.addEventListener('DOMContentLoaded', () => {
    const avatarContainer = document.getElementById('avatarContainer');
    const searchInput = document.getElementById('searchInput');
    const rarityFilter = document.getElementById('rarityFilter');
    const attributeFilter = document.getElementById('attributeFilter');
    const ownershipFilter = document.getElementById('ownershipFilter');
    const ownedCountSpan = document.getElementById('ownedCount');
    const totalCountSpan = document.getElementById('totalCount');

    let allAvatars = []; // 全アバターデータを保持
    let ownedAvatars = new Set(); // 所有しているアバターのIDを保持 (Setで高速な参照)

    // レアリティと属性の表示順序を定義
    const RARITY_ORDER = { 'L': 0, 'E': 1, 'R': 2, 'U': 3 };
    const ATTRIBUTE_ORDER = {
        'fire': 0, 'water': 1, 'tree': 2, 'thunder': 3, 'light': 4, 'dark': 5
    };

    /**
     * アバターデータを読み込み、初期表示とローカルストレージからの復元を行う
     */
    async function initializeAvatars() {
        try {
            const response = await fetch('avatars.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allAvatars = await response.json();

            // IDに基づいてソート（L -> E -> R -> U, 属性順）
            allAvatars.sort((a, b) => {
                const rarityDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
                if (rarityDiff !== 0) return rarityDiff;
                return ATTRIBUTE_ORDER[a.attribute] - ATTRIBUTE_ORDER[b.attribute];
            });

            loadOwnedAvatars(); // ローカルストレージから所有状況を読み込む
            updateAvatarDisplay(); // アバター表示を更新
        } catch (error) {
            console.error('Failed to load avatars:', error);
            avatarContainer.innerHTML = '<p style="text-align: center; color: red;">アバターデータの読み込みに失敗しました。</p>';
        }
    }

    /**
     * アバターの表示を更新 (フィルタリング、検索適用後)
     */
    function updateAvatarDisplay() {
        const searchText = searchInput.value.toLowerCase();
        const selectedRarity = rarityFilter.value;
        const selectedAttribute = attributeFilter.value;
        const selectedOwnership = ownershipFilter.value;

        const filteredAvatars = allAvatars.filter(avatar => {
            // 検索フィルタ
            if (searchText && !avatar.name_ja.toLowerCase().includes(searchText)) {
                return false;
            }
            // レアリティフィルタ
            if (selectedRarity !== 'all' && avatar.rarity !== selectedRarity) {
                return false;
            }
            // 属性フィルタ
            if (selectedAttribute !== 'all' && avatar.attribute !== selectedAttribute) {
                return false;
            }
            // 所有状況フィルタ
            const isOwned = ownedAvatars.has(avatar.id);
            if (selectedOwnership === 'owned' && !isOwned) {
                return false;
            }
            if (selectedOwnership === 'not-owned' && isOwned) {
                return false;
            }
            return true;
        });

        renderAvatars(filteredAvatars); // フィルタされたアバターを描画
        updateCounts(filteredAvatars.length); // カウントを更新
    }

    /**
     * 指定されたアバターリストをHTMLに描画する
     * @param {Array} avatarsToRender - 描画するアバターの配列
     */
    function renderAvatars(avatarsToRender) {
        avatarContainer.innerHTML = ''; // 一度クリア

        if (avatarsToRender.length === 0) {
            avatarContainer.innerHTML = '<p style="text-align: center; color: #777;">条件に合うアバターが見つかりませんでした。</p>';
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

                // 新しいレアリティグループ用のコンテナを作成
                const rarityGroupContainer = document.createElement('div');
                rarityGroupContainer.className = 'rarity-group-container';
                avatarContainer.appendChild(rarityGroupContainer);
                currentRarityGroup = rarityGroupContainer;

                // レアリティ見出しを作成
                const rarityHeading = document.createElement('h2');
                rarityHeading.className = 'rarity-heading';
                rarityHeading.textContent = `【${avatar.rarity} レアリティ】`;
                currentRarityGroup.appendChild(rarityHeading);
            }

            if (currentAttribute !== avatar.attribute) {
                currentAttribute = avatar.attribute;

                // 新しい属性グループ用のコンテナを作成
                const attributeGroupContainer = document.createElement('div');
                attributeGroupContainer.className = 'attribute-group-container';
                currentRarityGroup.appendChild(attributeGroupContainer);
                currentAttributeGroup = attributeGroupContainer;

                // 属性見出しを作成
                const attributeHeading = document.createElement('h3');
                attributeHeading.className = 'attribute-heading';
                attributeHeading.textContent = `-- ${getAttributeName(avatar.attribute)}属性 --`;
                currentAttributeGroup.appendChild(attributeHeading);

                // 新しいアバターグリッドを作成
                const newAvatarGrid = document.createElement('div');
                newAvatarGrid.className = 'avatar-grid';
                currentAttributeGroup.appendChild(newAvatarGrid);
            }

            // アバターアイテムを作成し、適切なグリッドに追加
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
    }

    /**
     * アバターの所有状況を切り替える
     * @param {string} avatarId - 切り替えるアバターのID
     * @param {HTMLElement} avatarItemElement - アバターのDOM要素
     */
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

    /**
     * 所有しているアバターのIDをローカルストレージに保存する
     */
    function saveOwnedAvatars() {
        localStorage.setItem('ownedAvatars', JSON.stringify(Array.from(ownedAvatars)));
    }

    /**
     * ローカルストレージから所有しているアバターのIDを読み込む
     */
    function loadOwnedAvatars() {
        const saved = localStorage.getItem('ownedAvatars');
        if (saved) {
            ownedAvatars = new Set(JSON.parse(saved));
        }
    }

    /**
     * 所有数と全アバター数を更新する
     * @param {number} displayedCount - 現在表示されているアバターの数
     */
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

    /**
     * 属性の英語名から日本語名を取得するヘルパー関数
     * @param {string} attributeKey - 属性の英語キー (e.g., 'fire')
     * @returns {string} 属性の日本語名
     */
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

    // 初期化
    initializeAvatars();

    // 親ページに高さを伝える関数
    function postHeightMessage() {
        if (window.parent) {
            const bodyHeight = document.body.scrollHeight;
            window.parent.postMessage({
                height: bodyHeight
            }, 'https://sthenoskallos.com');
        }
    }

    // ページの読み込み時と、コンテンツ変更時に高さを伝える
    window.addEventListener('load', postHeightMessage);
    const observer = new MutationObserver(postHeightMessage);
    observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
    });
    // フィルターや検索が行われた際にも高さを伝える
    rarityFilter.addEventListener('change', postHeightMessage);
    attributeFilter.addEventListener('change', postHeightMessage);
    ownershipFilter.addEventListener('change', postHeightMessage);
    searchInput.addEventListener('input', postHeightMessage);
});