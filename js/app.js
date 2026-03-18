import { initFirebase, loginUser, getCurrentUser, logout, getLeaderboard, resetBalance } from './firebase-service.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Navigation logic for SPA
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    
    function navigateTo(targetId) {
        if (!getCurrentUser() && targetId !== 'home') {
            alert("Veuillez vous connecter d'abord !");
            return;
        }
        
        navBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.nav-btn[data-target="${targetId}"]`).classList.add('active');
        
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'leaderboard') {
            loadLeaderboard();
        }
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navigateTo(e.target.dataset.target);
        });
    });

    // Sub-view Game Interfaces
    const playBtns = document.querySelectorAll('.play-btn');
    const backBtns = document.querySelectorAll('.back-btn');
    const gamesGrid = document.querySelector('.games-grid');
    const gameInterfaces = document.querySelectorAll('.game-interface');

    playBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameType = e.target.dataset.game;
            gamesGrid.classList.add('hidden');
            document.getElementById(`interface-${gameType}`).classList.remove('hidden');
        });
    });

    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gameInterfaces.forEach(gi => gi.classList.add('hidden'));
            gamesGrid.classList.remove('hidden');
        });
    });

    // Init Firebase/Local Auth System
    await initFirebase(); 

    // Auth UI interaction
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username-input');
    const authSection = document.getElementById('auth-section');
    const userInfo = document.getElementById('user-info');
    const userBalanceSpan = document.getElementById('user-balance');
    const resetBalanceBtn = document.getElementById('reset-balance-btn');
    const logoutBtn = document.getElementById('logout-btn');

    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        if (username.length < 3) {
            alert("Le pseudo doit faire au moins 3 caractères.");
            return;
        }
        
        loginBtn.textContent = "Connexion...";
        loginBtn.disabled = true;
        
        const user = await loginUser(username);
        
        authSection.classList.add('hidden');
        userInfo.style.display = 'flex';
        updateBalanceUI(user.balance);
        
        document.querySelector('#home h1').innerHTML = `Bienvenue, <span>${user.username}</span>`;
        document.querySelector('#home p').textContent = "Prêt à tenter votre chance ?";
        
        navigateTo('games');
        
        loginBtn.textContent = "Rejoindre la Compétition";
        loginBtn.disabled = false;
    });

    logoutBtn.addEventListener('click', () => {
        logout();
        userInfo.style.display = 'none';
        authSection.classList.remove('hidden');
        document.querySelector('#home h1').textContent = "Entrez dans l'arène de la chance";
        document.querySelector('#home p').textContent = "Des jeux équitables à 50/50. Grimpez au classement.";
        usernameInput.value = '';
        navigateTo('home');
    });

    resetBalanceBtn.addEventListener('click', async () => {
        resetBalanceBtn.disabled = true;
        const newBal = await resetBalance();
        window.updateBalanceUI(newBal);
        alert("Votre solde a été réinitialisé à 1000 💰 ! Que la chance soit avec vous !");
        resetBalanceBtn.disabled = false;
    });

    // Global function used by games.js
    window.updateBalanceUI = function(amount) {
        userBalanceSpan.textContent = amount + " 💰";
        
        // Add a shiny effect when balance changes
        userBalanceSpan.style.textShadow = "0 0 20px #fff";
        userBalanceSpan.style.color = "#fff";
        setTimeout(() => {
            userBalanceSpan.style.textShadow = "0 0 10px rgba(255, 215, 0, 0.5)";
            userBalanceSpan.style.color = "#ffd700";
        }, 300);

        if (amount < 10) {
            resetBalanceBtn.classList.remove('hidden');
        } else {
            resetBalanceBtn.classList.add('hidden');
        }
    };

    // Leaderboard generation
    const tabBtns = document.querySelectorAll('.tab-btn');
    let currentSort = 'balance';

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentSort = e.target.dataset.sort;
            loadLeaderboard();
        });
    });

    async function loadLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '<div class="loadingSpinner"></div>';
        
        const data = await getLeaderboard(currentSort);
        
        list.innerHTML = '';
        if (data.length === 0) {
            list.innerHTML = '<li>Aucun joueur pour le moment.</li>';
        }
        
        data.forEach((user, index) => {
            const li = document.createElement('li');
            let statVal = user[currentSort] || 0;
            li.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="username">${user.username}</span>
                <span class="score">${statVal} 💰</span>
            `;
            list.appendChild(li);
        });
    }
});
