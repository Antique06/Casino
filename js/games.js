import { getCurrentUser, updateBalance } from './firebase-service.js';

document.addEventListener('DOMContentLoaded', () => {

    let isAnimating = false;
    let currentRouletteRotation = 0;

    // ----- Coin Flip Setup -----
    const coinBtns = document.querySelectorAll('#interface-coinflip .bet-btn');
    const coinInput = document.getElementById('bet-coinflip');
    const coinElement = document.getElementById('coin-element');
    const resultCoin = document.getElementById('result-coinflip');

    coinBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (isAnimating) return;
            const choice = e.target.dataset.choice; // "heads" or "tails"
            await playGame('coinflip', choice, coinInput, coinElement, resultCoin, renderCoinFlipResult);
        });
    });

    // ----- Color Match Setup -----
    const colorBtns = document.querySelectorAll('#interface-color .bet-btn');
    const colorInput = document.getElementById('bet-color');
    const rouletteElement = document.getElementById('roulette-element');
    const resultColor = document.getElementById('result-color');

    colorBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (isAnimating) return;
            const choice = e.target.dataset.choice; // "red" or "black"
            await playGame('color', choice, colorInput, rouletteElement, resultColor, renderRouletteResult);
        });
    });

    // ----- Core Game Logic Engine -----
    async function playGame(gameType, choice, inputElem, animElem, resultElem, renderCb) {
        const user = getCurrentUser();
        if (!user) return;

        const betAmount = parseInt(inputElem.value);
        if (isNaN(betAmount) || betAmount <= 0) {
            alert("Mise invalide.");
            return;
        }
        if (betAmount > user.balance) {
            alert("Fonds insuffisants !");
            return;
        }

        isAnimating = true;
        resultElem.className = "result-message"; // reset classes
        resultElem.classList.remove('show');

        // Deduct bet securely for realism before animation begins
        const newBal = await updateBalance(-betAmount, true); // true indicates a wager 
        window.updateBalanceUI(newBal);

        // Core 50/50 Probability Logic
        const roll = Math.random();
        const isWin = roll >= 0.5;

        // Render specific UI animation associated with the game
        await renderCb(animElem, choice, isWin);

        // Process Result and Update Text
        resultElem.classList.add('show');
        if (isWin) {
            resultElem.textContent = `Gagné ! +${betAmount * 2} 💰`;
            resultElem.classList.add('win');
            const finalBal = await updateBalance(betAmount * 2);
            window.updateBalanceUI(finalBal);
        } else {
            resultElem.textContent = `Perdu... -${betAmount} 💰`;
            resultElem.classList.add('lose');
        }

        isAnimating = false;
    }

    // ----- UI Animations -----

    function renderCoinFlipResult(elem, choice, isWin) {
        return new Promise(resolve => {
            const winningFace = isWin ? choice : (choice === 'heads' ? 'tails' : 'heads');

            // Remove flip to reset it
            elem.classList.remove('flip');
            void elem.offsetWidth; // trigger reflow to restart anim

            elem.textContent = "";
            elem.classList.add('flip');

            setTimeout(() => {
                elem.classList.remove('flip');
                elem.textContent = winningFace === 'heads' ? "Pile" : "Face";
                resolve();
            }, 2000);
        });
    }

    function renderRouletteResult(elem, choice, isWin) {
        return new Promise(resolve => {
            const winningColor = isWin ? choice : (choice === 'red' ? 'black' : 'red');

            // 16 pockets, each 22.5 degrees. (8 red, 8 black)
            // Red pockets: even indices (0, 2, ..., 14)
            // Black pockets: odd indices (1, 3, ..., 15)
            let pocketIndex;
            if (winningColor === 'red') {
                pocketIndex = Math.floor(Math.random() * 8) * 2;
            } else {
                pocketIndex = Math.floor(Math.random() * 8) * 2 + 1;
            }

            let baseRot = 360 * 5; // Spin 5 times
            
            // Calculate target offset to align the center of the pocket at 12 o'clock (0deg)
            let centerOffset = 360 - (pocketIndex * 22.5 + 11.25);
            
            // Add slight randomization within the pocket boundaries (-8 to +8 degrees)
            let randomAdjustment = (Math.random() * 16) - 8;
            
            let targetAbsoluteRotation = centerOffset + randomAdjustment;
            
            // Find distance to the target position from the current remainder
            let remainder = currentRouletteRotation % 360;
            let toNext = (targetAbsoluteRotation - remainder + 360) % 360;
            
            // Add base spins + calculated distance to land exactly where needed
            currentRouletteRotation = currentRouletteRotation + baseRot + toNext;

            elem.style.transition = 'transform 3s cubic-bezier(0.1, 0.7, 0.1, 1)';
            elem.style.transform = `rotate(${currentRouletteRotation}deg)`;

            setTimeout(() => {
                resolve();
            }, 3000); // sync with transition time
        });
    }

});
