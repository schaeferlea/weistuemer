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
        resetButton.addEventListener("click", () => {
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
        } catch {
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

            const rendered = md.render(entry.text || "");

            const cleaned = (entry.text || "").replace(/\[\^(\d+)\]/g, '').replace(/\[\^(\d+)\]:(.*)$/gm, '');
            const plain = cleaned.replace(/\n/g, ' ');
            const preview = plain.split(/\s+/).slice(0, 25).join(" ") + " …";

            resultItem.innerHTML = `
                <h3>${entry.titel}</h3>
                <p><strong>Edition:</strong> ${entry.edition?.stelle || "-"}</p>
                <p><strong>Ort:</strong> ${entry.ort}</p>
                <p><strong>Region:</strong> ${entry.region}</p>
                <p><strong>Zeit:</strong> ${entry.zeit} (${entry.zeit_kategorie})</p>
                <p><strong>Typ:</strong> ${entry.typ}</p>
                <p><strong>Schreiberinfo:</strong> ${entry.schreiberinfo || "-"}</p>
                <p><strong>Text:</strong>
                    <span class="text-preview">${preview}</span>
                    <button class="toggle-text">Mehr</button>
                    <span class="text-full hidden">${rendered}</span>
                </p>
                ${entry.original_link ? `<p><a href="${entry.original_link}" target="_blank">Original-Link</a></p>` : ""}
            `;

            resultsContainer.appendChild(resultItem);

            const toggleBtn = resultItem.querySelector(".toggle-text");
            const previewEl = resultItem.querySelector(".text-preview");
            const fullEl = resultItem.querySelector(".text-full");

            toggleBtn.addEventListener("click", () => {
                fullEl.classList.toggle("hidden");
                previewEl.classList.toggle("hidden");
                toggleBtn.textContent = fullEl.classList.contains("hidden") ? "Mehr" : "Weniger";
            });
        });
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
        const abschnittMatch = rawZeit.match(/(Anfang|Mitte|Ende)\s*(\d{1,2})\.\s*Jh\./i);
        if (abschnittMatch) {
            const abschnitt = abschnittMatch[1].toLowerCase();
            return `${abschnitt[0].toUpperCase()}${abschnitt.slice(1)} ${abschnittMatch[2]}. Jh.`;
        }
        return "unbekannt";
    }

    document.getElementById("export-csv-btn").addEventListener("click", () => {
        exportToCSV(dataset, "weistuemer_export.csv");
    });

    function exportToCSV(data, filename) {
        const headers = ["id", "titel", "ort", "region", "zeit", "zeit_kategorie", "typ", "schreiberinfo", "text", "Fussnoten"];
        const csvRows = [headers.join(",")];

        data.forEach(entry => {
            const raw = entry.text || "";
            const inline = raw.replace(/\[\^(\d+)\]/g, "[$1]");
            const notes = [];
            const textClean = inline.replace(/^\[\^(\d+)\]:(.*)$/gm, (match, num, txt) => {
                notes.push(`${num}: ${txt.trim()}`);
                return "";
            }).replace(/\n/g, " ").trim();

            const row = [
                entry.id,
                entry.titel,
                entry.ort,
                entry.region,
                entry.zeit,
                entry.zeit_kategorie,
                entry.typ,
                entry.schreiberinfo || "",
                textClean.replace(/"/g, '""'),
                notes.join(" | ").replace(/"/g, '""')
            ].map(v => `"${v}"`).join(",");

            csvRows.push(row);
        });

        const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
