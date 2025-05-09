
document.addEventListener("DOMContentLoaded", function () {
    let dataset = [];

    const md = window.markdownit().use(window.markdownitFootnote);

    fetch("data.json")
        .then(response => response.json())
        .then(data => {
            dataset = data;
            kategorisiereAlleZeiten(dataset);
            populateDropdowns(dataset);
            displayResults(dataset);
            initializeMap(dataset);
        });

    const searchInput = document.getElementById("search-input");
    const resetButton = document.getElementById("reset-search-btn");

    searchInput.addEventListener("input", performSearch);

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            searchInput.value = "";
            document.getElementById("filter-typ").value = "";
            document.getElementById("filter-region").value = "";
            document.getElementById("filter-zeit").value = "";
            performSearch(); 
        });
    }

    function performSearch() {
        const query = searchInput.value.trim();
        let regex;
        try {
            regex = new RegExp(query, "i");
        } catch (e) {
            document.getElementById("results").innerHTML = "<p>⚠️ Ungültiger regulärer Ausdruck.</p>";
            return;
        }

        const filtered = dataset.filter(entry =>
            Object.values(entry).some(value =>
                regex.test(typeof value === "object" ? JSON.stringify(value) : String(value))
            )
        );

        displayResults(filtered, query);
    }

    function displayResults(data, query = "") {
        const resultsContainer = document.getElementById("results");
        resultsContainer.innerHTML = "";

        if (!data.length) {
            resultsContainer.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            return;
        }

        data.forEach(entry => {
            const resultItem = document.createElement("div");
            resultItem.classList.add("result-item");
            resultItem.id = entry.id;

            const htmlFull = md.render(entry.text || "");

            const htmlPreview = htmlFull
                .replace(/<section class="footnotes">[\s\S]*$/g, "")
                .replace(/<sup[^>]*>.*?<\/sup>/g, "");

            const div = document.createElement("div");
            div.innerHTML = htmlPreview;
            const plain = div.textContent || div.innerText || "";
            const words = plain.trim().split(/\s+/).filter(Boolean);
            const shortText = words.slice(0, 20).join(" ") + (words.length > 20 ? " …" : "");

            const highlightedText = query ? highlightText(htmlFull, query) : htmlFull;

            resultItem.innerHTML = `
                <h3>${entry.titel}</h3>
                <p><strong>Edition:</strong> ${entry.edition?.stelle || "-"}</p>
                <p><strong>Ort:</strong> ${entry.ort}</p>
                <p><strong>Region:</strong> ${entry.region}</p>
                <p><strong>Zeit:</strong> ${entry.zeit} (${entry.zeit_kategorie})</p>
                <p><strong>Typ:</strong> ${entry.typ}</p>
                <p><strong>Schreiberinfo:</strong> ${entry.schreiberinfo || "-"}</p>
                <p><strong>Text:</strong>
                    <span class="text-preview">${shortText}</span>
                    <button class="toggle-text">Mehr</button>
                    <span class="text-full hidden">${highlightedText}</span>
                </p>
                ${entry.original_link ? `<p><a href="\${entry.original_link}" target="_blank">Original-Link</a></p>` : ""}
            `;

            resultsContainer.appendChild(resultItem);

            const toggleButton = resultItem.querySelector(".toggle-text");
            const preview = resultItem.querySelector(".text-preview");
            const full = resultItem.querySelector(".text-full");

            toggleButton.addEventListener("click", function () {
                const isHidden = full.classList.contains("hidden");
                full.classList.toggle("hidden");
                preview.classList.toggle("hidden");
                toggleButton.textContent = isHidden ? "Weniger" : "Mehr";
            });
        });
    }

    function highlightText(text, query) {
        try {
            const regex = new RegExp(query, "gi");
            return text.replace(regex, match => `<span class="highlight">${match}</span>`);
        } catch {
            return text;
        }
    }

    function populateDropdowns(data) {
        populateDropdown("filter-typ", data.map(d => d.typ));
        populateDropdown("filter-region", data.map(d => d.region));
        populateDropdown("filter-zeit", data.map(d => d.zeit_kategorie));
    }

    function populateDropdown(id, values) {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        [...new Set(values)].sort().forEach(val => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            dropdown.appendChild(opt);
        });
        dropdown.addEventListener("change", filterResults);
    }

    function filterResults() {
        const typ = document.getElementById("filter-typ").value;
        const region = document.getElementById("filter-region").value;
        const zeit = document.getElementById("filter-zeit").value;

        const filtered = dataset.filter(entry =>
            (typ === "" || entry.typ === typ) &&
            (region === "" || entry.region === region) &&
            (zeit === "" || entry.zeit_kategorie === zeit)
        );

        displayResults(filtered);
    }

    function initializeMap(data) {
        const map = L.map('map').setView([49.0, 9.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        data.forEach(entry => {
            if (entry.koordinaten?.lat && entry.koordinaten?.lng) {
                const marker = L.marker([entry.koordinaten.lat, entry.koordinaten.lng]).addTo(map);
                marker.on('click', () => {
                    const target = document.getElementById(entry.id);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        document.querySelectorAll('.result-item').forEach(el => el.classList.remove('highlight-entry'));
                        target.classList.add('highlight-entry');
                        setTimeout(() => target.classList.remove('highlight-entry'), 3000);
                    }
                });
            }
        });
    }

    function kategorisiereAlleZeiten(dataset) {
        dataset.forEach(entry => {
            entry.zeit_kategorie = kategorisiereZeit(entry.zeit);
        });
    }

    function kategorisiereZeit(rawZeit) {
        if (!rawZeit || typeof rawZeit !== "string") return "unbekannt";
        const zeit = rawZeit.toLowerCase();
        const jahrMatch = zeit.match(/(\d{3,4})/);
        if (jahrMatch) {
            const jahr = parseInt(jahrMatch[1]);
            const jahrhundert = Math.floor((jahr - 1) / 100) + 1;
            const mod = jahr % 100;
            const abschnitt = mod <= 33 ? "Anfang" : mod <= 66 ? "Mitte" : "Ende";
            return `${abschnitt} ${jahrhundert}. Jh.`;
        }
        const abschnittMatch = zeit.match(/(anfang|mitte|ende)\s*(\d{1,2})\.\s*jh/);
        if (abschnittMatch) {
            return \`\${abschnittMatch[1][0].toUpperCase() + abschnittMatch[1].slice(1)} \${abschnittMatch[2]}. Jh.\`;
        }
        return "unbekannt";
    }
});
