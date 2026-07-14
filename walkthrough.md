# Health Tracker PWA - Teljes Verzió Walkthrough 🌟

Az alkalmazás most már teljesen elkészült, letölthető PWA-ként működik, és tartalmazza a feladat összes specifikus igényét (számítások az Excel adatok alapján, statisztikák, PWA telepíthetőség, több kulcs kezelése, Redis és Vercel beállítások).

A frissítések már sikeresen felkerültek a GitHub tárolódba!

---

## 1. PWA és Letölthetőség 📱
Hogy az alkalmazás **telepíthető (letölthető)** legyen a telefonodra vagy a gépedre, a következőket valósítottam meg:
*   **Szolgáltatás Munkás (`sw.js`)**: Létrehoztam az offline gyorsítótárazást végző Service Workert, ami elengedhetetlen a PWA futtatásához.
*   **PWA Regisztráció**: Bekötöttem a Service Workert az `app.js`-be.
*   **PWA Ikonok**: Generáltam egy prémium, modern "Health Tracker" logót és elhelyeztem a megfelelő méretekben (`icon-192x192.png`, `icon-512x512.png` és `favicon.ico`).
*   **Manifest Kapcsolat**: Frissítettem a `manifest.json`-t, így a böngészők (Chrome, Safari, Edge) azonnal fel fogják ajánlani az **"Alkalmazás telepítése"** vagy a **"Hozzáadás a kezdőképernyőhöz"** opciót.

---

## 2. Hogyan és Milyen néven kösd be a Vercel-en? 🔑

Lépj be a Vercel fiókodba a projekthez, menj a **Settings -> Environment Variables** fülre, és add meg az alábbi változókat:

### A) Google Gemini AI (Több kulcs támogatásával!)
*   **Név (Key):** `GEMINI_API_KEY`
*   **Érték (Value):** Ide másold be az API kulcsodat. 
*   > [!TIP]
    > **Több kulcs rögzítése:** Ha több kulcsot is szeretnél megadni, egyszerűen **vesszővel elválasztva** írd be őket egymás után (szóközök nélkül). Pl: `AIzaSyA1...key1,AIzaSyB2...key2,AIzaSyC3...key3`
    > Az alkalmazás automatikusan rotálja és kipróbálja őket: ha az egyik korlátba ütközik vagy hibás, azonnal próbálja a következőt!
*   **Modell megadása (Opcionális):** Ha a modellt is módosítani akarod, hozz létre egy `AI_MODEL` változót. Alapértelmezett: `gemini-1.5-flash`.

### B) Upstash Redis Adatbázis Bekötése
Az Upstash Redis konzolból másold ki a REST adatokat, és hozd létre ezt a két változót a Vercelen:
1.  **Név (Key):** `UPSTASH_REDIS_REST_URL`
    *   **Érték:** A Redis Rest URL-ed (pl. `https://xxxx-xxxx.upstash.io`).
2.  **Név (Key):** `UPSTASH_REDIS_REST_TOKEN`
    *   **Érték:** A hozzá tartozó titkos token string.

---

## 3. Megvalósított Új Funkciók és Logika 🛠️

### A) 100-as skálájú WDMS Pontozás (Napi, Heti, Havi, Éves)
Beolvastam a `MIND_Dieta_Algoritmus_Adatbazis-v3_Teljes.xlsx` táblát, amiből elkészült a tökéletes `data/food_database.json` az összes súllyal ($W_i$). A pontozás a **Weighted Density Model for Scoring** (WDMS) alapján történik:
*   **Ma / Hét / Hónap / Év pontszámok:** Külön-külön gombok és kártyák jelzik a Dashboardon. A rendszer kiszámolja az adott időszakban elfogyasztott ételek súlyozott átlagát ($\sum (amount_i \cdot W_i) / T \cdot 100$), majd egy Szigmoid transzformációval ($k=0.05$) feszíti 0-100-as skálára.
*   **Változási Index (Progress Score):** A Kettős Mozgóátlag ($SMA_7 - SMA_{30}$) és a szórás ($\sigma$ - konzisztencia) alapján méri, hogy mennyire stabil és javuló a táplálkozásod.

### B) Statisztika és Előzmények Fül (ÚJ!)
Létrehoztam egy teljesen új fület, ahol láthatod:
*   **Heti Trend Grafikon:** Egy gyönyörű line chart (Chart.js segítségével) ábrázolja az elmúlt 7 nap egészségügyi pontjait.
*   **Gyakori Ételek:** Megmutatja, miket ettél a leggyakrabban.
*   **Napi Bontású Előzmény:** Visszamenőleg listázza, melyik nap pontosan milyen adagokat rögzítettél.

### C) Étrend Változatossága és Korlátok (Diversity Tab)
*   **MDD-W Élelmiszercsoportok:** Számolja, hogy a 10 fontos csoportból (gabona, hüvelyes, hús, tejtermék, tojás, leveles zöldség stb.) hányat ettél a héten.
*   **Heti 30-as Szabály:** Számolja a különböző növényi ételeket.
*   **Szigorú Maximumok (Figyelmeztetések):** Figyeli a heti limiteket. Ha túl sok vörös húst, sajtot, gyorsételt, vajat vagy édességet eszel, piros riasztással jelzi a felületen.

### D) Autocomplete Kereső (UX fejlesztés)
A Napló fülön a beviteli mezőnél most már **automatikus kitöltő (autocomplete)** működik: ahogy elkezded gépelni az ételt, felkínálja a 145 db Excelben szereplő pontos élelmiszert.
