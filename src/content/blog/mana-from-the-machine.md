---
title: "Mana from the Machine: An AI-Powered MTG Set Generator"
date: 2025-04-18
excerpt: "Building an AI system that generates complete, custom Magic: The Gathering sets, covering theme creation, card mechanics, AI-generated artwork, rendering, and creating playable output for virtual tabletops."
tags: ["board games"]
cover: "/blog/mana-from-the-machine/cover.webp"
shelf: games
---

Straight to the code: <https://github.com/wingedsheep/mtg-card-generator>

View a [generated set](/blog/mana-from-the-machine/#:~:text=Showcasing%20a%20full%20generated%20set).

It had been a while since I'd really engaged with Magic: The Gathering, but a recent booster draft with friends completely rekindled my interest. The strategic depth, the artwork, the world-building – it all came flooding back. This got me thinking about the creative process behind the game.

On a subsequent free day, curiosity led me down an internet rabbit hole: could you render custom Magic cards in a browser? A quick search turned up a promising open-source project ([mtgrender.tk](https://www.mtgrender.tk/)), and that sparked an idea. What if I could use AI to generate not just *one* card, but an entire, cohesive set?

The initial concept came together surprisingly quickly – I managed to get a basic version running in about a day. However, refining the process, improving the AI prompts, handling edge cases, and fixing subtle rendering bugs took significantly more time and effort. The goal became clear: build a system to generate *complete*, playable MTG sets, from the initial theme right down to rendered card images ready for a virtual tabletop.

I wasn't just aiming for random card names and abilities. I wanted sets with:

- **A Cohesive Theme:** A distinct world, factions, and mechanical identity.
- **Balanced Distribution:** Reasonable counts of different rarities (Common, Uncommon, Rare, Mythic Rare) and colors (White, Blue, Black, Red, Green).
- **Unique Artwork:** Fitting illustrations for every card, generated on the fly.
- **Realistic Rendering:** Output that looks like actual MTG cards.
- **Playability:** A way to actually use the generated cards, ideally in a simulator, or ready to print.

This presented several interesting challenges, touching on Large Language Models (LLMs), text-to-image generation, web rendering, and automation.

### Challenge 1: Rendering the Cards

Before generating anything, I needed a way to visualize the final product. How could I turn structured card data (name, cost, text, etc.) into something that *looks* like a Magic card?

My online search led me to the fantastic open-source project [mtgrender.tk](https://www.mtgrender.tk/) by Yoann 'Senryoku' Maret-Verdant ([Senryoku on GitHub](https://senryoku.github.io/)). Senryoku is also involved in other cool MTG projects like [Draftmancer](https://draftmancer.com/), so definitely check out their work! Mtgrender takes card data in the Scryfall JSON format and renders beautiful card images directly in the browser using Vue.

This was almost perfect, but the original project was a full Vue application. For my generator, I wanted something simpler – a self-contained HTML and JavaScript renderer that I could easily automate. This felt like a job for an AI assistant! I fed the core rendering logic from mtgrender to Google Gemini 2 and asked it to refactor it into plain HTML and JavaScript.

The result wasn't instantly flawless – there were bugs to fix and adjustments needed – but it provided a massive head start. It successfully stripped away the Vue framework complexities, leaving a core HTML page (`index.html`), some CSS (`style.css`), and JavaScript (`script.js`, `helpers.js`) that could take a Scryfall-like JSON input and render a card.

With a rendering solution in hand, I could move on to generating the actual content.

```
card-rendering/
├───example-input.json  # Example Scryfall-like JSON
├───helpers.js          # Helper functions for rendering
├───index.html          # The main HTML structure
├───script.js           # Core rendering logic
└───style.css           # Card styling
```

<figure>
<img src="/blog/mana-from-the-machine/image.webp" alt="" loading="lazy" />
<figcaption>A MTG card in the scryfall JSON format, rendered in the renderer</figcaption>
</figure>

### Challenge 2: Crafting the World – Theme Generation

A good MTG set isn't just a random collection of cards; it has a story, a world, unique mechanics, and factions. How could I generate this cohesive vision automatically?

I turned to LLMs via the [OpenRouter](https://openrouter.ai/) API. The idea was to provide the LLM with some *inspiration* and ask it to build a theme around it.

1. **Inspiration:** I started with a CSV file containing data for many existing MTG cards. My script randomly selects a small number of these (`inspiration_cards_count` in the config, e.g., 50 cards) to serve as examples of what MTG cards look like and the kind of concepts they embody.
2. **Prompting:** I fed the names and types of these inspiration cards to the LLM (configured as `main_model` in my `Config` class, often something powerful like Gemini 2.5 pro) and asked it to generate a detailed set theme. This included a world description, key factions, prominent creature types, mechanical themes, potential synergies, and supported play styles.

```python
# Simplified concept from MTGSetGenerator
def generate_theme(self, inspiration_cards: List[str]) -> str:
    prompt = f"""
    Based on the following randomly selected Magic: The Gathering card names and types,
    generate a detailed and cohesive theme for a new MTG set.

    Inspiration Cards:
    {inspiration_cards}

    Describe the world, key factions, prominent creature types,
    mechanical themes, potential synergies, and supported play styles.
    Make it creative and evocative.
    """
    # ... (Call to OpenRouter API using self.config.openai_client) ...
    theme_description = # ... response from LLM ...
    return theme_description
```

This approach provided a solid thematic foundation. I also added a feature (`complete_theme_override` in the config) to allow users to bypass this step and provide their own pre-written theme if they had a specific vision.

### Challenge 3: Populating the World – Card Generation & Balancing

With a theme established, the next step was creating the actual cards. This involved several sub-challenges:

- Generating card concepts (name, mana cost, type, text, flavor) that fit the theme.
- Ensuring a reasonable distribution of rarities within each batch of generated cards.
- Maintaining an overall color balance across the entire set.

Again, I used the OpenRouter API (`main_model`). The process worked in batches (`batches_count` in the config):

1. **Batch Definition:** For each batch, I specified how many cards of each rarity I wanted (e.g., 1 Mythic, 3 Rares, 4 Uncommons, 5 Commons, defined in the config).
2. **Contextual Prompting:** The LLM received the set theme, the desired rarity distribution for the *current batch*, and statistics about the cards generated *so far* (especially the current color distribution).
3. **Balancing Hints:** If the set was becoming too heavy in one color (e.g., too many Blue cards compared to the target `color_distribution`), the prompt would subtly nudge the LLM: "The set currently needs more Green and White cards. Please try to include some in this batch."
4. **Output:** The LLM generated the card concepts for the batch.

```python
# Simplified concept from MTGSetGenerator
def generate_batch_cards(self, batch_num: int, current_stats: Dict) -> List[Card]:
    # ... (Determine target rarities for this batch) ...
    # ... (Calculate color balance hints based on current_stats and config.color_distribution) ...

    prompt = f"""
    Set Theme: {self.set_theme}

    Generate {total_cards_in_batch} new Magic: The Gathering card concepts for this set.
    Ensure they fit the theme.

    Desired Rarity Distribution for this Batch:
    - Mythics: {self.config.mythics_per_batch}
    - Rares: {self.config.rares_per_batch}
    # ... etc ...

    Current Set Color Balance: {current_stats['color_distribution']}
    Target Color Balance: {self.config.color_distribution}
    {color_balance_hint} # e.g., "Hint: Consider creating more Green cards."

    Provide concepts including name, mana cost, type, rarity, card text, and flavor text.
    For creatures, include power/toughness. For planeswalkers, include loyalty.
    """
    # ... (Call LLM, parse response into Card objects) ...
    generated_cards = # ... parsed Card objects ...
    return generated_cards

# Statistics are tracked across batches
def _calculate_statistics(self, cards: List[Card]) -> Dict:
    rarity_counts = Counter(card.rarity for card in cards)
    color_counts = Counter()
    # ... (count colors) ...
    return { "card_count": len(cards), "rarity_distribution": ..., "color_distribution": ... }
```

This iterative, batch-based approach with feedback allowed the set to grow organically while maintaining better control over the final composition.

### Challenge 4: Bringing Cards to Life – Art Generation

A Magic card isn't complete without its art. This was a two-step process: generating a suitable *art prompt* and then feeding that prompt to a text-to-image model.

**Step 4a: Generating Art Prompts**

Simply using the card name or text as an image prompt often yields generic results. I needed detailed prompts that captured the essence of the card *and* fit the MTG art style.

- **Input:** The LLM (`main_model`) received the full card details (name, type, text, flavor, color, Power/Toughness, theme context) and the set theme.
- **Prompt Engineering:** The prompt specifically asked for an "Oil on canvas painting. Magic the gathering art. Rough brushstrokes." style and instructed the LLM to consider composition, lighting, mood, and key details from the card's mechanics and flavor.
- **Special Cases:** I added specific instructions for "Saga" cards, which require vertical artwork, asking the LLM to create a prompt describing a *vertical* composition.
- **Safety:** To avoid issues with image generation filters, I added lines emphasizing the need for a "SAFE" prompt on retry attempts if generation failed.

```python
# From MTGArtGenerator.py
def generate_art_prompt(self, card: Card, attempt: int = 0) -> str:
    theme_context = f"Set Theme Context:\n{self.theme}\n..." if self.theme else ""
    saga_instructions = "IMPORTANT: This is a Saga card which requires VERTICAL art..." if "Saga" in card.type else ""

    prompt = f"""
    Create a detailed art prompt for a Magic: The Gathering card...
    {saga_instructions}
    Theme: {theme_context}
    Card Name: {card.name}
    Type: {card.type}
    # ... (include all card details) ...

    Make sure that the prompt fits the style of Magic: The Gathering art...
    The prompt should begin with "Oil on canvas painting. Magic the gathering art. Rough brushstrokes."
    {f"Please make sure it is a really SAFE prompt! ..." if attempt > 1 else ""}
    Return only the prompt text...
    """
    # ... (Call LLM via self.client.chat.completions.create) ...
    art_prompt = # ... response from LLM ...
    return art_prompt
```

**Step 4b: Generating Images**

With detailed art prompts, I used the [Replicate](https://replicate.com/) platform to access text-to-image models.

- **Model Choice:** I configured the system to use different models, primarily testing Google's `imagen-3` and Black Forest Labs' `flux-1.1-pro` (`image_model` and `replicate_models` in `Config`). Imagen 3 generally produced excellent results aligning with the MTG aesthetic.
- **API Call:** The generated art prompt was sent to the chosen Replicate model endpoint.
- **Aspect Ratio & Cropping:** MTG cards typically use a 5:4 aspect ratio for art, while Sagas use 4:5 (vertical). I configured the image generation call (`_get_model_params`) to request the appropriate ratio. If the model couldn't produce the exact ratio (some models prefer square), I added a cropping step using Python's PIL (Pillow) library (`crop_to_5x4_ratio`, `crop_to_4x5_ratio`) to center-crop the image to the target dimensions.
- **Retry Logic:** Image generation can sometimes fail. For example if the generated image doesn't pass the NSFW filters. The `generate_card_art` function included retry logic with increasing safety instructions in the art prompt generation step.

An example result from the art generator for the `Mirror Shell Wyvern`.

<figure>
<img src="/blog/mana-from-the-machine/Mirror-Shell_Wyvern.webp" alt="" loading="lazy" />
<figcaption>Oil on canvas painting. Magic the Gathering art. Rough brushstrokes. A colossal wyvern glides silently above a twilight-shrouded skyline of the mirrored cityscape of Veritas. Its translucent wings ripple like warped glass, each beat distorting the sky behind it with stars and reflections sliding across its skin like oil on water. The dragon's form is incomplete and ghostlike; hollow sections of its body reveal fragments of the real world behind it, subtly out of sync with the rest of the scene, as if time itself is uncertain around it. Its eyes are crystalline mirrors, refracting images of both watcher and watched.Below, rooftops and towers curve inward, their surfaces covered with surveillance runes and illusion glyphs. As the wyvern passes overhead, these symbols flicker and sputter as though truth peeks through the cracks. A citizen on a balcony gazes up in awe, their face reflected threefold in the wyvern's belly scales, each reflection conveying a different expression: fear, realization, and acceptance. The lighting is eerie and soft, dominated by moonlight diffused by magical haze. Soft blue-violet hues dominate the composition, with iridescent highlights tracing the dragon's outline. The mood is contemplative, mysterious, and slightly foreboding, echoing the idea that witnessing the wyvern brings fleeting clarity: a glimpse of hidden truth before it vanishes like a dream. Art style blends classical fantastical realism with subtle surreal expressions, evoking a sense of fragmented memory and veiled perception. Painterly textures enhance the shifting effect of the dragon's form, using impasto for the shimmering illusion-wings and glazing for background reflections. Intentional blurring at the edges of the wyvern suggests temporality unraveling. Oil on canvas artwork.</figcaption>
</figure>

### Challenge 5: The Conversion Pipeline – JSON and Automated Rendering

Now I had card concepts (text) and card art (images), but the renderer needed Scryfall-like JSON.

- **JSON Conversion:** I used *another* LLM call (`json_model` in `Config`, often something fast and good at formatting like Gemini Flash) specifically for this conversion task. It took the generated card text, the art prompt, and the path to the saved artwork image, and structured it into the required JSON format. This was handled by the `MTGJSONConverter` class.
- **Automated Rendering:** Manually rendering hundreds of cards via the HTML/JS app was impractical. I used [Playwright](https://playwright.dev/python/), a browser automation library, to solve this. The `MTGCardRenderer` class scripted the following:

1. Launch a headless browser.
2. Open the local `index.html` rendering page.
3. Inject the generated Scryfall JSON data for a card into the page's JavaScript.
4. Wait for the card to render.
5. Take a screenshot of the rendered card element.
6. Save the screenshot as a PNG file.
7. Repeat for all generated JSON files.

![](/blog/mana-from-the-machine/image-3.webp)

### Challenge 6: Don't Forget the Lands!

Basic lands (Plains, Island, Swamp, Mountain, Forest) are crucial. I added a dedicated step using `MTGLandGenerator`:

- It generates a specified number (`land_variations_per_type`) of variations for each basic land type.
- It uses the set theme to generate appropriate art prompts for these lands.
- It follows the same art generation, JSON conversion, and rendering pipeline as regular cards.
- It correctly assigns collector numbers sequentially after the main set cards

### Cost and Speed Considerations

Automating set generation with AI is powerful, but involves API costs and processing time. Here's a rough breakdown based on the default configuration (13 cards/batch, 20 batches/set) and approximate API pricing at the time of writing.  
  
So in total you will have a set with 260 unique cards. MTG sets usually range between 250 and 300 cards.

| Metric | Value | Notes |
| --- | --- | --- |
| Image Gen Cost/Card | ~$0.05 USD | Using Imagen 3 via Replicate |
| Text Gen Cost/Batch | ~$0.01 USD | Theme, concepts, prompts, JSON conversion |
| **Total Cost/Batch** | **~$0.66 USD** | (13 images \* $0.05) + $0.01 text |
| **Total Set Cost** | **~$13-14 USD** | 20 batches + basic lands |
| **Time/Batch** | **~5 minutes** | Includes text, image gen, conversion |
| **Total Set Time** | **~100 minutes (~1h 40m)** | 20 batches |

### Challenge 7: Ready for Play – Tabletop Simulator Conversion

Having nice PNG images is great, but I wanted to *play* with the cards in a draft format. Tabletop Simulator (TTS) is a popular platform for virtual board gaming, and I wanted to create proper booster packs for drafting.

I developed a Booster Draft Generator (`mtg-booster-generator.py`) that creates randomized booster packs:  
  
Running the script opens a GUI where you can select an output folder for one of your generated sets.

**Input:** The folder containing all rendered card images from my generated set

**Process:**

1. Creates 15-card boosters with the correct rarity distribution:

- 1 rare or mythic rare card
- 3 uncommon cards
- 11 common cards

1. Generates special boosters for each basic land type including all art variants
2. Arranges each booster pack into proper grid sheets for TTS import

![](/blog/mana-from-the-machine/image-6.webp)

**Output:** A `boosters` folder containing:

- Properly formatted deck sheets ready for TTS import
- Each sheet containing multiple boosters arranged in a grid

To use these boosters in Tabletop Simulator:

1. Open Tabletop Simulator and create a new game
2. Click "Objects" > "Components" > "Cards" > "Custom Deck"
3. Select the first booster sheet image for front images
4. Use `https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/f/f8/Magic_card_back.jpg/revision/latest` as the back image
5. Set the appropriate number of cards per row/column based on your grid size: For a generated booster this would be 4x4 with 15 cards.
6. Click "Import" to load the boosters into your game

<figure>
<img src="/blog/mana-from-the-machine/image-4.webp" alt="" loading="lazy" />
<figcaption>Add a custom deck component</figcaption>
</figure>

![](/blog/mana-from-the-machine/image-7.webp)

I used the [MTG Deluxe Table](https://steamcommunity.com/sharedfiles/filedetails/?id=2688047075) which has many built-in functions specifically for playing Magic: The Gathering, making the draft experience smooth and enjoyable.

And you are ready to play with the custom generated deck.

<figure>
<img src="/blog/mana-from-the-machine/image-1.webp" alt="" loading="lazy" />
<figcaption>One of the generated sets imported in tabletop simulator</figcaption>
</figure>

### Conclusion

This project turned out to be a fascinating exploration of combining different AI tools (LLMs for text and structure, Diffusion models for art) with web technologies and automation (HTML/JS rendering, Playwright, Python scripting) to tackle a creative challenge sparked by a simple booster draft. While the balance and playability won't match a human-designed set, the ability to generate a complete, themed, illustrated, and *usable* MTG set from scratch is quite remarkable. It was a rewarding journey from that initial spark of finding a renderer online to a fully automated pipeline. The next step: It would be really cool to be able to easily do a booster draft using the generated sets, or to print the cards and going from nothing to a completete physical set.

The code is open source and can be found on: <https://github.com/wingedsheep/mtg-card-generator>

If anyone decides to create their own set, I would love to see the results!

前髪の長さや分け目はキャラクター再現に関わるため、事前に調整しやすいか確認しておくと安心です。イベント前の準備では、[喜多川海夢 コスプレウィッグ](https://www.tsukicos.com/product-category/cosplay-wig/%e3%81%9d%e3%81%ae%e7%9d%80%e3%81%9b%e6%9b%bf%e3%81%88%e4%ba%ba%e5%bd%a2%e3%81%af%e6%81%8b%e3%82%92%e3%81%99%e3%82%8b-cosplay-wig/)を見てスタイリングの手順を想像しやすくなります。使う場面に合わせて整え方を変えることで、自然な仕上がりに近づけられます。

### Showcasing a full generated set

After generating the main cards and the basic lands, the pipeline renders them all into image files. Here's an example gallery showcasing some cards from a generated set, pulled directly from the project's GitHub repository. Click on any card to see a larger version.

<style>
  :root {
    --card-gap: 1rem;
    --card-radius: 10px;
  }

  #card-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--card-gap);
    margin: 2rem 0;
  }

  #card-gallery img {
    width: 100%;
    height: auto;
    border-radius: var(--card-radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, .25);
    transition: transform .2s ease, box-shadow .2s ease;
    cursor: pointer;
  }

  #card-gallery img:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 8px 16px rgba(0, 0, 0, .35);
  }

  /* Lightbox Styles */
  #gallery-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, .9);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: opacity .3s ease;
    z-index: 9999;
  }

  #gallery-lightbox.show {
    opacity: 1;
    visibility: visible;
  }

  /* Container to hold image relative to arrows */
  .lightbox-content {
    position: relative;
    max-width: 90%;
    max-height: 90%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #gallery-lightbox img {
    max-width: 100%;
    max-height: 85vh;
    border-radius: var(--card-radius);
    box-shadow: 0 0 30px rgba(0, 0, 0, .6);
    user-select: none; /* Prevents highlighting image while clicking fast */
  }

  /* Navigation Arrows */
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: none;
    font-size: 2rem;
    padding: 1rem;
    cursor: pointer;
    border-radius: 50%;
    transition: background .2s;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
  }

  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .prev-btn { left: -70px; }
  .next-btn { right: -70px; }

  /* Hide arrows on small screens, keep image huge */
  @media (max-width: 768px) {
    .nav-btn { position: fixed; width: 40px; height: 40px; font-size: 1.5rem; background: rgba(0,0,0,0.5); }
    .prev-btn { left: 10px; }
    .next-btn { right: 10px; }
  }
</style>
<div id="card-gallery"></div>
<div id="gallery-lightbox">
<div class="lightbox-content" onclick="event.stopPropagation()">
<button class="nav-btn prev-btn" id="prev-btn">&lt;</button>
<img alt="" id="lightbox-img"/>
<button class="nav-btn next-btn" id="next-btn">&gt;</button>
</div>
</div>
<script>
(async function(){
  const api = 'https://api.github.com/repos/wingedsheep/mtg-card-generator/contents/example-set-2';
  
  // State
  let cards = [];
  let currentIndex = 0;

  // DOM Elements
  const gallery = document.getElementById('card-gallery');
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  // Functions
  function openLightbox(index) {
    currentIndex = index;
    updateImage();
    lightbox.classList.add('show');
  }

  function closeLightbox() {
    lightbox.classList.remove('show');
  }

  function updateImage() {
    const card = cards[currentIndex];
    lightboxImg.src = card.download_url;
    lightboxImg.alt = card.name;
  }

  function nextImage() {
    currentIndex = (currentIndex + 1) % cards.length; // Loop to start
    updateImage();
  }

  function prevImage() {
    currentIndex = (currentIndex - 1 + cards.length) % cards.length; // Loop to end
    updateImage();
  }

  // Initialize
  try {
    const resp = await fetch(api);
    if(!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
    const files = await resp.json();

    // Filter and store card data
    cards = files.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.webp'));

    // Render Gallery
    cards.forEach((item, index) => {
      const img = new Image();
      img.src = item.download_url;
      img.alt = item.name.replace(/\.webp$/i,'');
      img.loading = 'lazy';
  
      img.addEventListener('click', () => {
        openLightbox(index);
      });
  
      gallery.appendChild(img);
    });

    // --- Event Listeners ---

    // 1. Close on background click
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    // 2. Visual Navigation Buttons
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent closing lightbox
      nextImage();
    });
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      prevImage();
    });

    // 3. Keyboard Navigation (Arrow Keys)
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('show')) return; // Only when open

      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'Escape') closeLightbox();
    });

  } catch(err) {
    console.error(err);
    gallery.innerHTML = '<p style="color:red">Failed to load card images. Please try again later.</p>';
  }
})();
</script>
