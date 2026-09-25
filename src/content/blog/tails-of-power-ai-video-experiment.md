---
title: "\"Tails of Power\": An AI-Generated Fantasy Trailer"
date: 2025-01-07
excerpt: "\"Tails of Power\" explores the current capabilities of AI video generation tools. By combining Midjourney's image generation, Kling AI's animation, and AI-generated music and sound effects, this project demonstrates both the potential and limitations of creating cinematic content with AI."
tags: ["AI Video"]
cover: "/blog/tails-of-power-ai-video-experiment/cover.webp"
shelf: ai
---

<!-- TODO: the "Tails of Power" trailer video was embedded here. The Ghost video card is broken on the live site too (only the player text '0:00/1×' survived), so the video file or a YouTube link has to be re-added by hand. -->

After seeing some hilarious photoshopped images of my girlfriend's cats dressed as a naval admiral and a general, I had an idea. What if we could create an entire fantasy epic trailer, something in the style of Game of Thrones or Lord of the Rings, but replace all the characters with majestic, heroic cats? With OpenAI's recent release of Sora, this seemed like the perfect moment to test the current state of AI video generation and bring "Tails of Power" to life.

## The Vision

Initially, I planned to use Sora as the cornerstone of this project. However, after some early experiments using a VPN (since it wasn't yet available in Europe), I realized that the current version wouldn't provide the consistency needed for a cohesive narrative. While Sora produces impressive details and fluid motion, it often completely transformed input images rather than animating them as intended.

This led me to explore different tools that would give me more precise control. Midjourney would handle the initial imagery creation, setting the visual foundation for our feline epic. Kling AI could then bring these images to life with fluid animation. The soundtrack would come from Udio's AI music generation, and ElevenLabs would provide those crucial atmospheric sound effects that make fantasy worlds feel alive.

## Creating the Foundation with Midjourney

Since I only had two original photos of the cats to work with, I needed a way to expand our cast of characters and create the epic environments they would inhabit. Midjourney became the cornerstone of this creative process.

First, I used Midjourney's image editor to expand our original cat photos to a cinematic 16:9 aspect ratio. These served as vital reference points, helping maintain the essence of our original cats throughout the generation process. I was gladly surprised by the cats showing on the banners after I extended the original image.

<figure>
<img src="/blog/tails-of-power-ai-video-experiment/image-2.webp" alt="" loading="lazy" />
<figcaption>Before</figcaption>
</figure>

<figure>
<img src="/blog/tails-of-power-ai-video-experiment/image-1.webp" alt="" loading="lazy" />
<figcaption>After</figcaption>
</figure>

To refine the output style, I spent time rating images through Midjourney's personalization feature. Think of it as teaching the AI your artistic preferences – the more you interact with it, the better it understands your vision. The rest of the magic came from writing detailed, evocative prompts. Here's one example that particularly captured the epic cinematic scope we were aiming for:

```
A cinematic 4K scene. movie still of humanoid cats aboard a majestic 18th-century naval ship,
the scene set during the Napoleonic era. Rough sea, large waves. The ship is detailed with
grand sails billowing in the wind, polished wooden decks, and intricate golden carvings on
the hull. The feline crew, dressed in historically accurate naval uniforms, works diligently:
some climbing the rigging, others manning cannons, and one standing proudly at the helm.
The captain, a regal cat in a decorated uniform, stands at the bow, gazing out over a vast,
turbulent ocean under a dramatic, stormy sky. The lighting is dynamic, with rays of sunlight
piercing through dark clouds, highlighting the ship's grandeur and the cats' heroic efforts.
Realistic. High quality. 4k. Rain. Soaked cat sailors. Realism, gritty.
```

Every element in this prompt serves a purpose, building layer upon layer of detail to create images that feel both cinematic and cohesive with my vision.

Here is a comparison of the images without and with personalization. Where you can see the personalized has a more cinematic feel to it:

<figure>
<img src="/blog/tails-of-power-ai-video-experiment/image-4.webp" alt="" loading="lazy" />
<figcaption>Without personalization</figcaption>
</figure>

<figure>
<img src="/blog/tails-of-power-ai-video-experiment/image-3.webp" alt="" loading="lazy" />
<figcaption>With personalization</figcaption>
</figure>

## Bringing Images to Life with Kling AI

Transforming our still images into fluid video sequences was the next challenge, and Kling AI 1.5 proved to be exactly what we needed. The tool excels at maintaining visual consistency throughout each clip, ensuring our cat characters remained recognizable and maintained their dignity even as they moved through complex scenes.

![](/blog/tails-of-power-ai-video-experiment/image-5.webp)

The generation process involves uploading your Midjourney image and providing detailed scene descriptions along with camera movement instructions. Here's an example of how we approached one of our mountain scenes:

```
Input: Mountain pass scene with armored cat warrior
Description: Cinematic scene of a humanoid cat on a mountain pass. Realistic. Gritty.
Camera Movement: Slow panning shot, starting from a low angle and gradually rising to
reveal the vast landscape beyond the pass. Subtle movement in the cat's cloak from
the wind.
```

While Kling AI's output quality is impressive, there are some practical considerations to keep in mind. The current pricing runs about $10 for nine 10-second clips, and you'll often need multiple attempts to get a scene exactly right. The clips are also limited to 5-10 seconds, which means carefully planning your transitions and scene structure.

## Crafting the Soundtrack with Udio

The visual elements needed an equally epic soundtrack to match. After experimenting with various AI music tools, I found Udio offered something special – while other tools like Suno tend to generate more conventional compositions, Udio has a knack for surprising you with unexpected yet fitting musical choices.

![](/blog/tails-of-power-ai-video-experiment/image-6.webp)

The process began with generating a 32-second base track using this prompt:

```
orchestral, triumphant, cinematic, epic, film score, cinematic classical, classical music,
western classical music, energetic, instrumental, anthemic, melodic, suspenseful
```

I set it to instrumental mode and used the Ultra generation quality setting in the advanced controls. From there, I extended the piece with intro and outro sections to create a complete musical journey that would carry our narrative.

## Adding Atmosphere with ElevenLabs

The finishing touch for our mountain scene came from ElevenLabs' sound effect generator. We needed howling winds to emphasize the desolation and majesty of the setting. The prompt was simple:

```
Wind howling through the mountains, eagle screeching in the distance
```

While the eagle calls might have gotten lost in the mix, the wind effects created exactly the haunting atmosphere we needed to complete the scene.

## Final Assembly in OpenShot

I used OpenShot Video Editor to combine all the generated elements. The main challenge was timing - matching key moments like cannon fire with the music's crescendos, putting scene transitions on the drumbeats, and adding atmospheric effects at the right spots.

The other challenge was maintaining a cohesive flow through the trailer. Since the clips came from different AI tools, I had to be careful about ordering the scenes and transitions to make everything feel connected and intentional.

![](/blog/tails-of-power-ai-video-experiment/image-7.webp)

## Lessons Learned

This project taught me a lot about the current state of AI video tools. I was really impressed by how far they had come already. Perhaps the most important lesson is that different tools excel at different aspects of creation. Midjourney's strength lies in generating consistent, high-quality still images. Kling AI excels at smooth, controlled animation. Udio brings unexpected musical creativity, while ElevenLabs adds those crucial atmospheric touches.

The cost of AI video generation remains significant, and you'll often need multiple iterations to achieve the desired result. Having a clear vision from the start helps minimize these iterations, and understanding each tool's strengths lets you really create something cool.

## Future Possibilities

The tools are becoming cheaper and better at an incredible pace. This hints at an exciting future where AI becomes a true creative medium - more like a paintbrush than an autonomous artist. Imagine being able to roughly act out scenes with basic props, then having AI transform them into fully realized fantasy sequences while maintaining your intended timing and movement.

Right now, creating something like "Tails of Power" requires juggling multiple specialized tools and accepting certain compromises in creative control. The tools are powerful but still feel separate - Midjourney for one thing, Kling for another, each with its own workflow and limitations.

I can see this changing soon with the emergence of integrated AI movie studio platforms. These would handle everything from concept art to final rendering in one cohesive package, with each step maintaining the creator's original vision. The key is that they would need to provide enough control at each stage - letting creators iterate and refine rather than just generating and hoping for the best.

At the rate things are progressing, I wouldn't be surprised to see someone create a Hollywood-quality movie from their bedroom before the end of this decade. All the pieces are there - we just need better integration and more precise control.

The goal isn't to have AI make movies for us, but to give creators new tools for expressing their ideas. Just as digital editing democratized filmmaking without taking away creative control, AI tools could open up new possibilities while keeping creators firmly in charge of the creative process.

If you're interested in exploring these tools yourself, I hope this breakdown helps you understand both their current capabilities and limitations. The technology is still early, but the path toward true creative control is becoming clearer with each advancement.
