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

        phaseShift += 0.025;
        requestAnimationFrame(drawSineWave);
    }

    drawSineWave();

    // Load blog posts
    loadBlogPosts();
});

async function loadBlogPosts() {
    const blogContainer = document.getElementById('blog-container');

    try {
        // Fetch the manifest to get list of blog posts
        const manifestResponse = await fetch('blog/manifest.json');
        if (!manifestResponse.ok) {
            console.error('Manifest response not ok:', manifestResponse.status);
            throw new Error('Could not load blog manifest');
        }
        const manifest = await manifestResponse.json();
        console.log('Loaded manifest:', manifest);

        const posts = [];

        // Load each blog post listed in manifest
        for (const file of manifest.posts) {
            try {
                const postResponse = await fetch(`blog/${file}`);
                if (!postResponse.ok) {
                    console.error(`Post response not ok for ${file}:`, postResponse.status);
                    throw new Error(`Could not load ${file}`);
                }
                const postText = await postResponse.text();
                const post = parseBlogPost(postText, file);
                posts.push(post);
                console.log('Loaded post:', post.title);
            } catch (error) {
                console.error(`Error loading blog post ${file}:`, error);
            }
        }

        // Sort posts by date (newest first)
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log('Total posts loaded:', posts.length);

        // Display posts
        if (posts.length === 0) {
            blogContainer.innerHTML = '<p style="color: #789cb5;">No blog posts yet.</p>';
        } else {
            posts.forEach(post => {
                const postElement = createBlogPostElement(post);
                blogContainer.appendChild(postElement);
            });
        }
    } catch (error) {
        console.error('Error loading blog posts:', error);
        blogContainer.innerHTML = '<p style="color: #789cb5;">Unable to load blog posts. Check console for errors.</p>';
    }
}

function parseBlogPost(content, filename) {
    const lines = content.split('\n');
    const post = {
        filename: filename,
        title: 'Untitled',
        date: new Date().toISOString().split('T')[0],
        author: 'Anonymous',
        content: ''
    };

    let contentStartIndex = 0;

    // Parse metadata from the beginning of the file
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('title:')) {
            post.title = line.substring('title:'.length).trim();
        } else if (line.startsWith('date:')) {
            post.date = line.substring('date:'.length).trim();
        } else if (line.startsWith('author:')) {
            post.author = line.substring('author:'.length).trim();
        } else if (line === '') {
            // Empty line marks the end of metadata
            contentStartIndex = i + 1;
            break;
        }
    }

    // Get the content (everything after metadata)
    post.content = lines.slice(contentStartIndex).join('\n').trim();

    return post;
}

function createBlogPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'blog-post';

    const titleElement = document.createElement('div');
    titleElement.className = 'blog-post-title';
    titleElement.textContent = post.title;

    const metaElement = document.createElement('div');
    metaElement.className = 'blog-post-meta';
    metaElement.textContent = `${post.date} by ${post.author}`;

    const contentElement = document.createElement('div');
    contentElement.className = 'blog-post-content';
    contentElement.textContent = post.content;

    postElement.appendChild(titleElement);
    postElement.appendChild(metaElement);
    postElement.appendChild(contentElement);

    // Toggle expand/collapse on click
    postElement.addEventListener('click', function () {
        this.classList.toggle('expanded');
    });

    return postElement;
}
