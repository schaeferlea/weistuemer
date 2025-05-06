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
            resultsContainer.innerHTML = "<p>⚠️ Ungültiger regulärer Ausdruck. Bitte gültige Eingabe verwenden.</p>";
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
            let resultItem = document.createElement("div");
            resultItem.classList.add("result-item");
            resultItem.id = entry.id;

            let formattedText = md.render(entry.text || "");
            let shortText = shortenText(formattedText);
            let highlightedText = query ? highlightText(formattedText, query) : formattedText;

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

            const toggleButton = resultItem.querySelector(".toggle-text");
            const preview = resultItem.querySelector(".text-preview");
            const full = resultItem.querySelector(".text-full");

            toggleButton.addEventListener("click", function () {
                full.classList.toggle("hidden");
                preview.classList.toggle("hidden");
                toggleButton.textContent = full.classList.contains("hidden") ? "Mehr" : "Weniger";
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

    function shortenText(text, length = 300) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = text;
        const textContent = tempDiv.textContent || tempDiv.innerText || "";
        if (textContent.length <= length) return text;
        return textContent.substring(0, length) + "...";
    }

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

    function kategorisiereZeit(rawZeit) {
        if (!rawZeit || typeof rawZeit !== "string") return "unbekannt";

        const zeit = rawZeit.toLowerCase();
        let jahr = null;
        let jahrhundert = null;
        let abschnitt = "";

        const jahrMatch = zeit.match(/(\d{3,4})/);
        if (jahrMatch) {
            jahr = parseInt(jahrMatch[1]);
            jahrhundert = Math.floor((jahr - 1) / 100) + 1;

            if (jahr % 100 <= 33) abschnitt = "Anfang";
            else if (jahr % 100 <= 66) abschnitt = "Mitte";
            else abschnitt = "Ende";

            return `${abschnitt} ${jahrhundert}. Jh.`;
        }

        const abschnittMatch = zeit.match(/(anfang|mitte|ende)\s*(\d{1,2})\.\s*jh/);
        if (abschnittMatch) {
            const a = abschnittMatch[1].charAt(0).toUpperCase() + abschnittMatch[1].slice(1);
            const jh = abschnittMatch[2];
            return `${a} ${jh}. Jh.`;
        }

        return "unbekannt";
    }

    function kategorisiereAlleZeiten(data) {
        data.forEach(entry => {
            entry.zeit_kategorie = kategorisiereZeit(entry.zeit);
        });
    }

    document.getElementById("export-csv-btn").addEventListener("click", function () {
        exportToCSV(dataset, "weistuemer_export.csv");
    });

    function exportToCSV(data, filename) {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(",")];

        data.forEach(entry => {
            const row = headers.map(header => {
                let value = entry[header];
                if (typeof value === "object") {
                    value = JSON.stringify(value);
                }
                if (typeof value === "string") {
                    value = value.replace(/"/g, '""');
                }
                return \`"\${value}"\`;
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
