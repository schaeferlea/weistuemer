document.addEventListener("DOMContentLoaded", function () {
    let dataset = [];

    // Daten laden
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

    searchInput.addEventListener("input", function () {
        performSearch();
    });

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
            const resultsContainer = document.getElementById("results");
            resultsContainer.innerHTML = "<p>⚠️ Ungültiger regulärer Ausdruck.</p>";
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

        if (data.length === 0) {
            resultsContainer.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            return;
        }

        data.forEach(entry => {
            let resultItem = document.createElement("div");
            resultItem.classList.add("result-item");
            resultItem.id = entry.id; 

            const md = window.markdownit().use(window.markdownitFootnote);
            let renderedText = md.render(entry.text || "");
            let highlightedText = highlightText(renderedText, query);
            let shortText = shortenText(entry.text);

            resultItem.innerHTML = `
                <h3>${entry.titel}</h3>
                <p><strong>Edition:</strong> ${entry.edition.stelle}</p>
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
            resultsContainer.appendChild(resultItem);

            // Toggle-Logik: Vorschau <-> Volltext umschalten
            const toggleButton = resultItem.querySelector(".toggle-text");
            const preview = resultItem.querySelector(".text-preview");
            const full = resultItem.querySelector(".text-full");

            toggleButton.addEventListener("click", function () {
                if (full.classList.contains("hidden")) {
                    full.classList.remove("hidden");
                    preview.classList.add("hidden");
                    toggleButton.textContent = "Weniger";
                } else {
                    full.classList.add("hidden");
                    preview.classList.remove("hidden");
                    toggleButton.textContent = "Mehr";
                }
            });
        });
    }

    function highlightText(text, query) {
        if (!query) return text;
        let regex;
        try {
            regex = new RegExp(query, "gi");
        } catch (e) {
            return text;
        }
        return text.replace(regex, match => `<span class="highlight">${match}</span>`);
    }

    function formatLineBreaks(text) {
        return text.replace(/\n/g, "<br>");
    }

    // Hier limitieren wir auf 20 Wörter statt 200
    function shortenText(text, wordLimit = 20) {
        let plainText = text
            .replace(/\n/g, ' ')
            .replace(/\[\^(\d+)\]/g, '')
            .replace(/\[\^(\d+)\]:.*$/gm, '');
        let words = plainText.split(/\s+/).slice(0, wordLimit).join(" ");
        return words + "…";
    }

    // Restliche Funktionen unverändert: Filter-Dropdowns, Karte, CSV, Zeit-Kategorisierung
    function populateDropdowns(data) {
        populateDropdown("filter-typ", data.map(d => d.typ));
        populateDropdown("filter-region", data.map(d => d.region));
        populateDropdown("filter-zeit", data.map(d => d.zeit_kategorie));
    }
    function populateDropdown(id, values) {
        let dropdown = document.getElementById(id);
        if (!dropdown) return;
        let uniqueValues = [...new Set(values)].sort();
        uniqueValues.forEach(value => {
            let option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            dropdown.appendChild(option);
        });
        dropdown.addEventListener("change", filterResults);
    }
    function filterResults() {
        const typFilter = document.getElementById("filter-typ").value;
        const regionFilter = document.getElementById("filter-region").value;
        const zeitFilter = document.getElementById("filter-zeit").value;
        let filteredData = dataset.filter(entry =>
            (typFilter === "" || entry.typ === typFilter) &&
            (regionFilter === "" || entry.region === regionFilter) &&
            (zeitFilter === "" || entry.zeit_kategorie === zeitFilter)
        );
        displayResults(filteredData);
    }
    function initializeMap(data) {
        const map = L.map('map').setView([49.0, 9.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        data.forEach(entry => {
            if (entry.koordinaten && entry.koordinaten.lat && entry.koordinaten.lng) {
                let marker = L.marker([entry.koordinaten.lat, entry.koordinaten.lng]).addTo(map);
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
            const rest = jahr % 100;
            const abschnitt = (rest <= 33 ? "Anfang" : rest <= 66 ? "Mitte" : "Ende");
            return `${abschnitt} ${jahrhundert}. Jh.`;
        }
        const abschnittMatch = zeit.match(/(anfang|mitte|ende)\s*(\d{1,2})\.\s*jh/);
        if (abschnittMatch) {
            const abschnitt = abschnittMatch[1][0].toUpperCase() + abschnittMatch[1].slice(1);
            return `${abschnitt} ${abschnittMatch[2]}. Jh.`;
        }
        return "unbekannt";
    }

    // CSV-Export (unverändert)
    document.getElementById("export-csv-btn").addEventListener("click", function () {
        exportToCSV(dataset, "weistuemer_export.csv");
    });
    function exportToCSV(data, filename) {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]);
        const csvRows = [];
        csvRows.push(headers.join(","));
        data.forEach(entry => {
            const row = headers.map(header => {
                let value = entry[header];
                if (typeof value === "object") {
                    value = JSON.stringify(value);
                }
                if (typeof value === "string") {
                    value = value.replace(/"/g, '""');
                }
                return `"${value}"`;
            }).join(",");
            csvRows.push(row);
        });
        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
