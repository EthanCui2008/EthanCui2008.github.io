document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('sineWaveCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let phaseShift = 0;
    const numberOfWaves = 4;
    let wave_vals = [];
    const depth = 30;

    for (let i = 0; i < numberOfWaves; i++) {
        let randomNumbers = [];
        for (let j = 0; j < depth - i; j++) {
            const randomval = ((Math.random() * 4) + 3) + (Math.random() * 2) + 2;
            randomNumbers.push(randomval);
        }
        wave_vals.push(randomNumbers);
    }

    function drawSineWave() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const amplitude = 70;
        const frequency = 0.2;

        const shade_list = ['#1f317b', '#14639e', '#84ccc9', '#b6dacc'];

        for (let i = 0; i < numberOfWaves; i++) {
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2 + i * 50);
            for (let x = 0; x < canvas.width; x++) {
                let y = 0;
                for (let j = 0; j < depth - i; j++) {
                    y += Math.sin(wave_vals[i][j] * (x / 500) - ((((i + 1) ** 1.05)) * phaseShift / 20) + 500 * wave_vals[i][j]);
                }
                y = (amplitude * y * frequency);
                ctx.lineTo(x, (canvas.height / 2) + y + ((i ** 1.7) * 50) - 100);
            }
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();

            ctx.fillStyle = shade_list[3 - i];

            ctx.fill();
        }

        phaseShift += 0.01;
        requestAnimationFrame(drawSineWave);
    }

    drawSineWave();
});
