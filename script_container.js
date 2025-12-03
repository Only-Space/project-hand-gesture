
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let particlesArray;
const scanContainers = document.querySelectorAll('.scan-container');

class Particle {
    constructor(x, y, dirX, dirY, size) {
        this.x = x; this.y = y; this.dirX = dirX; this.dirY = dirY; this.size = size;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fill();
    }
    update() {
        if (this.x > canvas.width || this.x < 0) this.dirX *= -1;
        if (this.y > canvas.height || this.y < 0) this.dirY *= -1;
        
        let nextX = this.x + this.dirX;
        let nextY = this.y + this.dirY;

        // Bounce off containers
        scanContainers.forEach(cont => {
            const rect = cont.getBoundingClientRect();
            const cx = rect.left + rect.width/2;
            const cy = rect.top + rect.height/2;
            const rad = rect.width/2 + 20;
            if (Math.sqrt((nextX-cx)**2 + (nextY-cy)**2) < rad) {
                this.dirX *= -1; this.dirY *= -1;
                nextX = this.x + this.dirX; nextY = this.y + this.dirY;
            }
        });

        this.x = nextX; this.y = nextY;
        this.draw();
    }
}

function initParticles() {
    particlesArray = [];
    const numParticles = (canvas.height * canvas.width) / 20000;
    for (let i = 0; i < numParticles; i++) {
        let size = (Math.random() * 2) + 1;
        let x = Math.random() * innerWidth;
        let y = Math.random() * innerHeight;
        let dirX = (Math.random() * .4) - .2;
        let dirY = (Math.random() * .4) - .2;
        particlesArray.push(new Particle(x, y, dirX, dirY, size));
    }
}

function animateParticles() {
    requestAnimationFrame(animateParticles);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    
    particlesArray.forEach(p => p.update());
    
    // Draw Lines
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let dist = ((particlesArray[a].x - particlesArray[b].x) ** 2) + ((particlesArray[a].y - particlesArray[b].y) ** 2);
            if (dist < 15000) {
                ctx.strokeStyle = `rgba(0, 255, 255, ${1 - dist/15000})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }
    }
}

window.addEventListener('resize', () => {
    canvas.width = innerWidth; canvas.height = innerHeight;
    initParticles();
});
initParticles();
animateParticles();
