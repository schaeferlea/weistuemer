
// FINALE VERSION MIT MARKDOWN-IT + FUSSNOTEN FUNKTIONIERT GARANTIERT
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

        const filtered = dataset.filter(entry =>
            Object.values(entry).some(val =>
                regex.test(typeof val === "object" ? JSON.stringify(val) : String(val))
            )
        );

        displayResults(filtered, query);
    }

    function displayResults(data, query = "") {
        const container = document.getElementById("results");
        container.innerHTML = "";
        const md = window.markdownit().use(window.markdownitFootnote);

        if (data.length === 0) {
            container.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            return;
        }

        data.forEach(entry => {
            const html = md.render(entry.text || "");
            const shortText = shortenText(html);
            const highlightedText = query ? highlightText(html, query) : html;

            const div = document.createElement("div");
            div.classList.add("result-item");
            div.id = entry.id;

            div.innerHTML = `
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
                ${entry.original_link ? `<p><a href="${entry.original_link}" target="_blank">Original-Link</a></p>` : ""}
            `;

            container.appendChild(div);

            const btn = div.querySelector(".toggle-text");
            const preview = div.querySelector(".text-preview");
            const full = div.querySelector(".text-full");

            btn.addEventListener("click", () => {
                const expanded = !full.classList.contains("hidden");
                full.classList.toggle("hidden");
                preview.classList.toggle("hidden");
                btn.textContent = expanded ? "Mehr" : "Weniger";
            });
        });
    }

    function highlightText(text, query) {
        try {
            return text.replace(new RegExp(query, "gi"), match => `<span class="highlight">${match}</span>`);
        } catch {
            return text;
        }
    }

    function shortenText(html, maxWords = 20) {
        const temp = document.createElement("div");
        temp.innerHTML = html;
        const text = temp.textContent || temp.innerText || "";
        const words = text.split(/\s+/);
        return words.length <= maxWords ? html : words.slice(0, maxWords).join(" ") + " …";
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
        const reg = document.getElementById("filter-region").value;
        const zeit = document.getElementById("filter-zeit").value;
        const filtered = dataset.filter(e =>
            (typ === "" || e.typ === typ) &&
            (reg === "" || e.region === reg) &&
            (zeit === "" || e.zeit_kategorie === zeit)
        );
        displayResults(filtered);
    }

    function initializeMap(data) {
        const map = L.map('map').setView([49, 9.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        data.forEach(e => {
            if (e.koordinaten?.lat && e.koordinaten?.lng) {
                const marker = L.marker([e.koordinaten.lat, e.koordinaten.lng]).addTo(map);
                marker.on('click', () => {
                    const el = document.getElementById(e.id);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                        el.classList.add("highlight-entry");
                        setTimeout(() => el.classList.remove("highlight-entry"), 3000);
                    }
                });
            }
        });
    }

    function kategorisiereZeit(raw) {
        if (!raw || typeof raw !== "string") return "unbekannt";
        const match = raw.match(/(\d{3,4})/);
        if (match) {
            const j = parseInt(match[1]);
            const jh = Math.floor((j - 1) / 100) + 1;
            const mod = j % 100;
            const abschnitt = mod <= 33 ? "Anfang" : mod <= 66 ? "Mitte" : "Ende";
            return `${abschnitt} ${jh}. Jh.`;
        }
        const alt = raw.match(/(anfang|mitte|ende)\s*(\d{1,2})\.\s*jh/i);
        if (alt) return `${alt[1][0].toUpperCase() + alt[1].slice(1)} ${alt[2]}. Jh.`;
        return "unbekannt";
    }

    function kategorisiereAlleZeiten(data) {
        data.forEach(e => e.zeit_kategorie = kategorisiereZeit(e.zeit));
    }

    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => exportToCSV(dataset, "weistuemer_export.csv"));
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
                return `"${val}"`;
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
