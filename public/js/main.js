const defaultConfig = {
    topbar_text: "Welcome to the Ultimate Gaming Experience!",
    brand_name_orange: "Game",
    brand_name_white: "On",
    hero_title: "Epic Gaming Awaits",
    hero_subtitle: "Join millions of players worldwide",
    esports_title: "Esports Arena",
    footer_text: "© 2024 GameOn. All rights reserved. Made with ❤️ for gamers worldwide."
};

let currentSlide = 0;
let currentQuote = 0;

function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

function handleLogin(event) {
    event.preventDefault();
    const phoneNumber = document.getElementById('phoneNumber').value;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'mt-4 p-4 bg-green-100 text-green-700 rounded-lg text-center';
    messageDiv.textContent = `Login successful! Welcome back.`;

    const form = event.target;
    form.parentNode.insertBefore(messageDiv, form.nextSibling);

    setTimeout(() => {
        closeLoginModal();
        messageDiv.remove();
        document.getElementById('phoneNumber').value = '';
    }, 2000);
}

function changeSlide(direction) {
    const slides = document.querySelectorAll('.hero-slide');
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + direction + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    updateSlideIndicators();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    slides[currentSlide].classList.remove('active');
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    updateSlideIndicators();
}

function updateSlideIndicators() {
    const indicators = document.querySelectorAll('.absolute.bottom-6 > div');
    indicators.forEach((indicator, index) => {
        if (index === currentSlide) {
            indicator.style.opacity = '1';
            indicator.style.transform = 'scale(1.3)';
        } else {
            indicator.style.opacity = '0.5';
            indicator.style.transform = 'scale(1)';
        }
    });
}

function autoSlide() {
    changeSlide(1);
}


const serverGames = [
    "airwar1941", "Ballsfun", "Bankrobbers", "Baseballcatcher", "Battletank",
    "Bikeracer", "Birdjumper", "Birds-Jump", "Birdyjump", "Blockit",
    "bluestory", "Boatracer", "Boom-Car", "BottleBlast/game", "Brainchallenger",
    "Bubble", "BunnyFunny", "CandyIslandAdventure", "Candyshop", "Castlerunner",
    "Cat-flap", "castel", "Cheesyrat", "ChopChop/game", "ColorValley/game",
    "Colourfulbook", "Cookie", "Crazy Runner", "DessertsMatch", "Digger-master",
    "Elefall", "Experiment", "FangedFunLP", "Farmmatch", "FasterorSlower/game",
    "FighterAircraft/game", "FindtheCat/game", "Fishybubbleshooter", "FlatBirdJump",
    "FlapyCherryBird", "Flip2match", "Fluffyrun", "FollowTheChemicalShapes",
    "FoxnRollPP-2", "FrogJump", "FunNpuzzle", "FunnyBearLauncher",
    "FunnyDragonJump", "FunnyRainyMan", "Funnypenguin", "Goal",
    "GoDown(u)", "GolfRush", "GroceryCashier/game", "GuessNumber/game",
    "HackerChallenge/game", "HelicopterControl", "Hideagift", "KidsPuzzle/game",
    "Kill-Rabbit", "KnightinLove/game", "Legoblocks", "Letsplayholi",
    "Match-color", "Minitractor",
    "NinjaJumper", "OpenRestaurant/game", "pandalove", "PaperShoot",
    "ParkingBoom", "PlanetSpin/game", "Pond", "PowerRunners",
    "rangervszombies", "RearrangeLetters/game", "ReverseGravity", "RobberRun/game",
    "Rotate360", "RunAtNorthPole", "RunVovanRun/game", "save-life",
    "ScaryPath", "ShadowNinja", "Side-Chain", "SkeletonLauncher",
    "Skyrace/game", "SkyWire", "SlowDown2", "SlotCarChallenge/game",
    "SnakevsBlock/game", "SpaceTreasureHunt", "squareadventure",
    "SummerMatch3/game", "SushiSwitch", "TheBoiledEggs/game", "thecaveoferror",
    "ThePuzzle", "timeball", "tom-jump", "Town-cars",
    "TrickshotBall/game", "TrueorFalse/game", "truth", "ufoflight",
    "Woblox", "YellowBlue"
];

function getCategory(name) {
    name = name.toLowerCase();

    if (name.includes("puzzle") || name.includes("match") || name.includes("find") || name.includes("color"))
        return "puzzle";

    if (name.includes("ninja") || name.includes("fight") || name.includes("tank") || name.includes("kill"))
        return "action";

    if (name.includes("restaurant") || name.includes("farm") || name.includes("cashier"))
        return "strategy";

    if (name.includes("run") || name.includes("jump") || name.includes("bird") || name.includes("car"))
        return "arcade";

    if (name.includes("goal") || name.includes("golf"))
        return "sports";

    return "arcade";
}

function renderGamesFromServer() {
    serverGames.forEach((game, index) => {
        const category = getCategory(game);
        const container = document.getElementById(`${category}Games`);
        const newgames = game.split("/")[0]
        if (!container) return;

        const card = document.createElement("div");
        card.className = "game-card card-3d bg-gray-800 rounded-xl overflow-hidden neon-border";

        card.innerHTML = `
            <div class="bg-gray-700 h-48 flex items-center justify-center text-4xl">
                <img 
                    src="http://gamzlab.com/games/107Games/${newgames}/img.png"
                    onerror="this.onerror=null; this.src='http://gamzlab.com/games/107Games/${newgames}/img.jpg';"
                >
            </div>

            <div class="p-4">
                <h3 class="text-xl font-bold" style="color:white;">${newgames}</h3>

                <button onclick="playGame('${game}')"
                    class="w-full mt-3 bg-[#ff6b00] text-white py-2 rounded-lg font-medium">
                    Play Now
                </button>
            </div>
        `;


        container.appendChild(card);
    });
}

function playGame(game) {
    const iframe = document.getElementById("gameFrame");
    const modal = document.getElementById("gameModal");

    iframe.src = `https://gamzlab.com/games/107Games/${game}/index.html`;
    modal.classList.remove("hidden");
}
function closeGame() {
    const modal = document.getElementById("gameModal");
    const iframe = document.getElementById("gameFrame");

    iframe.src = "";
    modal.classList.add("hidden");
}

function openFullscreen() {
    const iframe = document.getElementById("gameFrame");

    if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
    } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
    }
}
window.addEventListener("load", () => {
    renderGamesFromServer();
});


window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('mainContent').classList.add('visible');
    }, 2500);
});


async function onConfigChange(config) {
    const topbarTextEl = document.getElementById('topbarText');
    const brandNameEl = document.getElementById('brandName');
    const heroTitleEl = document.getElementById('heroTitle');
    const heroSubtitleEl = document.getElementById('heroSubtitle');
    const esportsTitleEl = document.getElementById('esportsTitle');
    const footerTextEl = document.getElementById('footerText');

    if (topbarTextEl) {
        topbarTextEl.textContent = config.topbar_text || defaultConfig.topbar_text;
    }

    if (brandNameEl) {
        brandNameEl.innerHTML = `<span class="text-orange-500">Game</span><span class="text-white">On</span>`;
    }

    if (heroTitleEl) {
        heroTitleEl.textContent = config.hero_title || defaultConfig.hero_title;
    }

    if (heroSubtitleEl) {
        heroSubtitleEl.textContent = config.hero_subtitle || defaultConfig.hero_subtitle;
    }

    if (esportsTitleEl) {
        const title = config.esports_title || defaultConfig.esports_title;
        esportsTitleEl.innerHTML = `<span class="text-orange-500">${title.split(' ')[0]}</span> ${title.split(' ').slice(1).join(' ')}`;
    }

    if (footerTextEl) {
        footerTextEl.textContent = config.footer_text || defaultConfig.footer_text;
    }
}

function scrollLeft(id) {
    document.getElementById(id).scrollLeft -= 300;
}

function scrollRight(id) {
    document.getElementById(id).scrollLeft += 300;
}


if (window.elementSdk) {
    window.elementSdk.init({
        defaultConfig: defaultConfig,
        onConfigChange: onConfigChange,
        mapToCapabilities: (config) => ({
            recolorables: [],
            borderables: [],
            fontEditable: undefined,
            fontSizeable: undefined
        }),
        mapToEditPanelValues: (config) => new Map([
            ["topbar_text", config.topbar_text || defaultConfig.topbar_text],
            ["brand_name", `${config.brand_name_orange || defaultConfig.brand_name_orange}${config.brand_name_white || defaultConfig.brand_name_white}`],
            ["hero_title", config.hero_title || defaultConfig.hero_title],
            ["hero_subtitle", config.hero_subtitle || defaultConfig.hero_subtitle],
            ["esports_title", config.esports_title || defaultConfig.esports_title],
            ["footer_text", config.footer_text || defaultConfig.footer_text]
        ])
    });
}
(function() {
    function c() {
        var b = a.contentDocument || a.contentWindow.document;
        if (b) {
            var d = b.createElement('script');
            d.innerHTML = "window.__CF$cv$params={r:'9a2ee173b45a4212',t:'MTc2Mzg4MjE4Mi4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";
            b.getElementsByTagName('head')[0].appendChild(d)
        }
    }
    if (document.body) {
        var a = document.createElement('iframe');
        a.height = 1;
        a.width = 1;
        a.style.position = 'absolute';
        a.style.top = 0;
        a.style.left = 0;
        a.style.border = 'none';
        a.style.visibility = 'hidden';
        document.body.appendChild(a);
        if ('loading' !== document.readyState) c();
        else if (window.addEventListener) document.addEventListener('DOMContentLoaded', c);
        else {
            var e = document.onreadystatechange || function() {};
            document.onreadystatechange = function(b) {
                e(b);
                'loading' !== document.readyState && (document.onreadystatechange = e, c())
            }
        }
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    let currentQuote = 0;
    const quotes = document.querySelectorAll("#quoteSlider .quote");

    if (quotes.length > 0) {
        quotes[0].classList.add("active");
    }

    function changeQuote() {
        quotes[currentQuote].classList.remove("active");
        currentQuote = (currentQuote + 1) % quotes.length;
        quotes[currentQuote].classList.add("active");
    }
    setInterval(changeQuote, 3000);
});

function startSubscription() {
    const banner = document.getElementById("subscriptionBanner");
    const portal = document.getElementById("mainContent");

    if (!banner || !portal) return;
    banner.classList.add("opacity-0", "pointer-events-none");
    portal.classList.remove("hidden");
    document.body.classList.remove("overflow-hidden");

    setTimeout(() => {
        banner.remove();
    }, 300);
}