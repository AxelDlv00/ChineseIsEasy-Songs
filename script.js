document.addEventListener('DOMContentLoaded', async () => {
    const poemList = document.getElementById('poem-list');
    const poemContainer = document.getElementById('poem-container');
    const welcomeMessage = document.getElementById('welcome-message');
    const tooltip = document.getElementById('tooltip');
    
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');

    openBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-open');
        } else {
            sidebar.classList.remove('collapsed');
        }
    });

    closeBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
        } else {
            sidebar.classList.add('collapsed');
        }
    });

    document.querySelector('.content').addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && e.target !== openBtn) {
            sidebar.classList.remove('mobile-open');
        }
    });

    async function initCatalog() {
        try {
            const response = await fetch('songs.json');
            if (!response.ok) throw new Error("Impossible de charger le catalogue");
            const poems = await response.json();
            
            poemList.innerHTML = '';
            
            poems.forEach((poem, index) => {
                const li = document.createElement('li');
                li.textContent = poem.title;
                li.setAttribute('data-file', poem.path);
                
                if (index === 0) {
                    li.classList.add('active');
                    loadPoem(poem.path);
                }
                
                poemList.appendChild(li);
            });
        } catch (error) {
            console.error(error);
            poemList.innerHTML = '<li style="color:red">Erreur : Catalogue introuvable</li>';
        }
    }

    poemList.addEventListener('click', async (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        document.querySelectorAll('#poem-list li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
        }

        const filepath = li.getAttribute('data-file'); 
        await loadPoem(filepath); 
    });

    async function loadPoem(filepath) {
        try {
            const response = await fetch(filepath);
            if (!response.ok) throw new Error(`Fichier introuvable : ${filepath}`);
            let markdown = await response.text();
            
            const folder = filepath.substring(0, filepath.lastIndexOf('/'));
            
            markdown = markdown.replace(/src=["']([^http].*?)["']/g, (match, srcPath) => {
                return `src="${folder}/${encodeURI(srcPath)}"`;
            });
            
            configureMarked(folder);
            parseAndRender(markdown);
            
            welcomeMessage.classList.add('hidden');
            poemContainer.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            poemContainer.innerHTML = `<div style="color:red; padding: 20px;">Erreur : Impossible de charger le fichier <b>${filepath}</b>.</div>`;
        }
    }

    function parseAndRender(markdown) {
        const sections = markdown.split('\n## ');
        const headerText = sections[0];
        
        let parolesText = "";
        let traductionText = "";
        let remainingMarkdown = "";

        // On identifie les nouvelles sections
        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            if (section.startsWith('Paroles')) {
                parolesText = section.replace('Paroles', '').trim();
            } else if (section.startsWith('Traduction')) {
                traductionText = section.replace('Traduction', '').trim();
            } else {
                remainingMarkdown += '## ' + section + '\n';
            }
        }

        document.getElementById('md-header').innerHTML = marked.parse(headerText);
        document.getElementById('md-content').innerHTML = marked.parse(remainingMarkdown);
        
        renderLyrics(parolesText, traductionText);
    }

    function configureMarked(folder) {
        const renderer = new marked.Renderer();
        renderer.image = function(href, title, text) {
            const newHref = href.startsWith('http') ? href : `${folder}/${encodeURI(href)}`;
            return `<div class="image-container" style="text-align:center;">
                        <img src="${newHref}" alt="${text}" style="max-width:100%; border-radius:10px;">
                        ${text ? `<p><em>${text}</em></p>` : ''}
                    </div>`;
        };
        marked.setOptions({ renderer: renderer });
    }

    function renderLyrics(paroles, traduction) {
        const container = document.getElementById('lyrics-container');
        container.innerHTML = '';
        
        const parolesLines = paroles.split('\n');
        
        // On récupère uniquement les lignes non vides pour faire correspondre Chinois -> Traduction
        const validParoles = parolesLines.filter(l => l.trim() !== '');
        const validTraductions = traduction.split('\n').filter(l => l.trim() !== '');

        // On vérifie le format de la traduction : est-ce que ChatGPT a fait 2 lignes (Pinyin + FR) pour 1 ligne de chinois ?
        const isDoubleLineFormat = validTraductions.length >= validParoles.length * 2;
        let tIndex = 0;

        parolesLines.forEach(line => {
            // Gestion des sauts de ligne (changement de couplet)
            if (line.trim() === '') {
                const br = document.createElement('div');
                br.className = 'stanza-break';
                container.appendChild(br);
                return;
            }

            const row = document.createElement('div');
            row.className = 'lyric-line';
            row.textContent = line.trim();

            let transHTML = "";

            if (tIndex < validTraductions.length) {
                if (isDoubleLineFormat) {
                    // Format : Ligne 1 = Pinyin, Ligne 2 = Français
                    const pinyin = validTraductions[tIndex].replace(/[*_]/g, '');
                    const francais = validTraductions[tIndex + 1].replace(/[*_]/g, '');
                    transHTML = `<div class="pinyin">${pinyin}</div><div class="meaning">${francais}</div>`;
                    tIndex += 2;
                } else {
                    // Format : Pinyin / Français sur la même ligne
                    const tLine = validTraductions[tIndex];
                    if (tLine.includes('/')) {
                        const parts = tLine.split('/');
                        const pinyin = parts[0].replace(/[*_]/g, '').trim();
                        const francais = parts.slice(1).join('/').replace(/[*_]/g, '').trim();
                        transHTML = `<div class="pinyin">${pinyin}</div><div class="meaning">${francais}</div>`;
                    } else {
                        // Si le format n'est pas respecté du tout
                        transHTML = `<div class="meaning">${tLine.replace(/[*_]/g, '')}</div>`;
                    }
                    tIndex++;
                }
            } else {
                transHTML = `<div class="meaning">Traduction non disponible</div>`;
            }

            setupTooltip(row, transHTML);
            container.appendChild(row);
        });
    }

    function setupTooltip(element, htmlContent) {
        element.addEventListener('mouseenter', () => {
            tooltip.innerHTML = htmlContent;
            
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            // On centre la bulle au-dessus de la ligne entière
            let leftPos = rect.left + (rect.width / 2) + window.scrollX;
            let topPos = rect.top + window.scrollY - 10;
            
            // Sécurité anti-débordement sur mobile
            const margin = 15;
            const minLeft = margin + window.scrollX;
            const maxRight = window.innerWidth - margin + window.scrollX;
            
            let tooltipLeftEdge = leftPos - (tooltipRect.width / 2);
            let tooltipRightEdge = leftPos + (tooltipRect.width / 2);
            
            if (tooltipLeftEdge < minLeft) {
                leftPos = minLeft + (tooltipRect.width / 2);
            } else if (tooltipRightEdge > maxRight) {
                leftPos = maxRight - (tooltipRect.width / 2);
            }

            tooltip.style.left = leftPos + 'px';
            tooltip.style.top = topPos + 'px';
            tooltip.classList.add('show');
        });

        element.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
    }

    initCatalog();
});