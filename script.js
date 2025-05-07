
document.addEventListener("DOMContentLoaded", function () {
    let dataset = [];

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

        const filteredData = dataset.filter(entry =>
            Object.values(entry).some(value =>
                regex.test(typeof value === "object" ? JSON.stringify(value) : String(value))
            )
        );

        displayResults(filteredData, query);
    }

    function displayResults(data, query = "") {
        const resultsContainer = document.getElementById("results");
        resultsContainer.innerHTML = "";

        const md = window.markdownit().use(window.markdownitFootnote);

        if (data.length === 0) {
            resultsContainer.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            return;
        }

        data.forEach(entry => {
            const resultItem = document.createElement("div");
            resultItem.classList.add("result-item");
            resultItem.id = entry.id;

            const fullText = md.render(entry.text || "");
            const previewText = shortenText(entry.text);

            const highlightedText = query ? highlightText(fullText, query) : fullText;

            resultItem.innerHTML = `
                <h3>${entry.titel}</h3>
                <p><strong>Edition:</strong> ${entry.edition?.stelle || "-"}</p>
                <p><strong>Ort:</strong> ${entry.ort}</p>
                <p><strong>Region:</strong> ${entry.region}</p>
                <p><strong>Zeit:</strong> ${entry.zeit} (${entry.zeit_kategorie})</p>
                <p><strong>Typ:</strong> ${entry.typ}</p>
                <p><strong>Schreiberinfo:</strong> ${entry.schreiberinfo || "-"}</p>
                <p><strong>Text:</strong>
                    <span class="text-preview"></span>
                    <button class="toggle-text">Mehr</button>
                    <span class="text-full hidden">${highlightedText}</span>
                </p>
                ${entry.original_link ? `<p><a href="${entry.original_link}" target="_blank">Original-Link</a></p>` : ""}
            `;

            resultItem.querySelector(".text-preview").textContent = previewText;

            resultsContainer.appendChild(resultItem);

            const toggleButton = resultItem.querySelector(".toggle-text");
            const preview = resultItem.querySelector(".text-preview");
            const full = resultItem.querySelector(".text-full");

            toggleButton.addEventListener("click", () => {
                const expanded = !full.classList.contains("hidden");
                full.classList.toggle("hidden");
                preview.classList.toggle("hidden");
                toggleButton.textContent = expanded ? "Mehr" : "Weniger";
            });
        });
    }

    function shortenText(markdownText, wordLimit = 20) {
        const cleanText = markdownText
            .replace(/\[\^(\d+)\]/g, '') // Fußnotenzeichen entfernen
            .replace(/\[\^(\d+)\]:.*$/gm, '') // Fußnotenblock entfernen
            .replace(/[#>*_`~\-]/g, '') // Markdown-Symbole
            .replace(/
/g, ' ')
            .trim();
        const words = cleanText.split(/\s+/).slice(0, wordLimit).join(" ");
        return words + " …";
    }

    function highlightText(text, query) {
        try {
            return text.replace(new RegExp(query, "gi"), match => `<span class="highlight">${match}</span>`);
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
        [...new Set(values)].sort().forEach(v => {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
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

    function kategorisiereZeit(rawZeit) {
        if (!rawZeit || typeof rawZeit !== "string") return "unbekannt";

        const match = rawZeit.match(/(\d{3,4})/);
        if (match) {
            const jahr = parseInt(match[1]);
            const jh = Math.floor((jahr - 1) / 100) + 1;
            const mod = jahr % 100;
            const abschnitt = mod <= 33 ? "Anfang" : mod <= 66 ? "Mitte" : "Ende";
            return `${abschnitt} ${jh}. Jh.`;
        }

        const abschnittMatch = rawZeit.match(/(anfang|mitte|ende)\s*(\d{1,2})\.\s*jh/i);
        if (abschnittMatch) {
            return \`\${abschnittMatch[1][0].toUpperCase() + abschnittMatch[1].slice(1)} \${abschnittMatch[2]}. Jh.\`;
        }

        return "unbekannt";
    }

    function kategorisiereAlleZeiten(data) {
        data.forEach(entry => {
            entry.zeit_kategorie = kategorisiereZeit(entry.zeit);
        });
    }

    function initializeMap(data) {
        if (!window.L) return;
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
                        target.scrollIntoView({ behavior: 'smooth' });
                        document.querySelectorAll('.result-item').forEach(el => el.classList.remove('highlight-entry'));
                        target.classList.add('highlight-entry');
                        setTimeout(() => target.classList.remove('highlight-entry'), 3000);
                    }
                });
            }
        });
    }

    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => exportToCSV(dataset, "weistuemerdatenbank_export.csv"));
    }

    function exportToCSV(data, filename) {
        if (!data?.length) return;
        const headers = Object.keys(data[0]);
        const rows = [headers.join(",")];

        data.forEach(entry => {
            const row = headers.map(h => {
                let val = entry[h];
                if (typeof val === "object") val = JSON.stringify(val);
                if (typeof val === "string") val = val.replace(/"/g, '""');
                return \`"\${val}"\`;
            }).join(",");
            rows.push(row);
        });

        const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
