---
title: "Music Generation - AI Song Contest 2021"
date: 2021-06-27
excerpt: "How we created a song for the AI Song Contest 2021 with the help of transformers and other music generation techniques."
tags: ["Music Generation", "Transformers", "GPT-3"]
cover: "/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/cover.webp"
shelf: music
---

## Introduction

At the start of April a friend called me to ask me if I wanted to participate in a competition called the "[AI Song Contest](https://www.aisongcontest.com/)". The goal of the contest is to bring musicians and data scientists together to create music using Artificial Intelligence. Last year, in 2020, the first edition of this contest was organised. We would have about a month to create everything needed to generate a song, so the musicians would have enough time to record and produce. I had some experience in machine learning, but none in generated music, so the deadline was intimidating. But after thinking about it for a minute I decided to go for it. I wanted to learn more about transformer models that seemed to have all these magical capabilities, and to learn about them while making music at the same time seemed perfect. I like to play guitar and always felt the urge to write my own songs. Also at that time I had just been granted access to the OpenAI Api, so I could put GTP-3 to the test with this challenge. I decided to take a week off from work, rent a chalet and focus completely on this challenge.

You can find our page on the AI Song Contest website:

<https://www.aisongcontest.com/participants/lovelacethemachines-2021>

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/LOVELACE___THE_MACHINES-TEAM_PICTURE_OF_THE_HUMANS.webp" alt="" loading="lazy" />
<figcaption>The team: Lovelace and the machines</figcaption>
</figure>

> Our team consisting of colleagues, friends and family who all hail from The Netherlands. The team started out with two colleagues and the whole thing just snowballed into a full-fledged team. Our data scientists are: Hennie, played Xylophone and piano for over 10 years and likes to learn from these type of contests; Rick, humanities major and notoriously a-musical; Salomon, jazz and piano player in a big band; Vincent, guitar player and always wondering how things work. And our musicians: Joëlle, singer-songwriter that ditched the whole music part to become just a writer; Thomas, composer and specialized in writing for film and games; Wendel, wellness manager by day, DJ by night (which still has something to do with wellness really). We set out on a dual quest: to find out if AI can become a new band member and to test some nice algorithms we don’t get to use during working hours.

## The challenge

The next week we had our first team meeting. We called ourselves "Lovelace & The machines", in reference to Ada Lovelace who was already thinking about machines that could compose music in the 19th century. She was far ahead of her time in thinking about computers, or Analytical Engines as she called them. In her notes she wrote:

> [The Analytical Engine] might act upon other things besides number, were objects found whose mutual fundamental relations could be expressed by those of the abstract science of operations, and which should be also susceptible of adaptations to the action of the operating notation and mechanism of the engine...Supposing, for instance, that the fundamental relations of pitched sounds in the science of harmony and of musical composition were susceptible of such expression and adaptations, the engine might compose elaborate and scientific pieces of music of any degree of complexity or extent.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/Ada_Lovelace_portrait-2.jpg" alt="" loading="lazy" />
<figcaption>Source: https://nl.wikipedia.org/wiki/Ada_Lovelace</figcaption>
</figure>

We started discussing the challenge ahead of us and the problems we needed to tackle to get there. The AI Song Contest did not have many requirements, except for the requirement to be creative and put AI to good use in the process of creating our song. We decided to do as much with AI as possible, and only give human input where it is necessary.

The following challenges needed to be tackled:

- Writing the chord sequences and melody
- Writing the lyrics
- Creating drum and bass lines
- Putting it all together into a song

Before we could decide on a strategy we first had to figure out what the existing state of the art methods were.

## Existing research

There has been a lot of progress in music generation in the past few years. I will mention some of the inspiration we had when creating our song.

### Magenta: Music Transformer

Since I was interested in learning more about transformers I set out to find out if transformer networks could be used to generate music. Since these networks excel in finding underlying structure of language, it seems like they might also be a good fit for figuring out the structure of music.

And indeed, I stumbled upon research by Google Magenta, the [music transformer](https://magenta.tensorflow.org/music-transformer). The music transformer uses midi like events as input and manages to create beautiful and expressive piano pieces.

Transformer networks use a mechanism called attention to find patterns in data. When generating a new note, instead of looking at the whole piece of music as equal it learns to identify the parts that influence what this note should be. How this attention mechanism functions when generating a song is beautifully visualised in Magenta's blogpost.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/music-transformer.webp" alt="" loading="lazy" />
<figcaption>Source: https://magenta.tensorflow.org/music-transformer</figcaption>
</figure>

### Magenta: MusicVAE

Another technique that might be interesting for generating music is the auto-encoder. An auto-encoder gets raw data as input, pushes it through a neural network with a small layer in the middle, and tries to reconstruct the raw data in the output layer again. By pushing the data through this small layer in the middle you force the network to figure out how to compress the data. The space of possible compressed representations is called the latent space.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/image.webp" alt="" loading="lazy" />
<figcaption>Source: https://towardsdatascience.com/deep-inside-autoencoders-7e41f319999f</figcaption>
</figure>

In the [Magenta MusicVAE](https://magenta.tensorflow.org/music-vae) a variational auto-encoder is used. Instead of representing the data as a vector it is represented as a mixture of distributions. This adds the property that you can make smooth interpolations between two points in the latent space. This is very cool, because if you would interpolate between two musical samples all the samples in between would also sound good.

### OpenAI Jukebox

We found that OpenAI had been doing some super exciting work in this direction. They created a neural network called [Jukebox](https://openai.com/blog/jukebox/) that generates music as raw audio, and can even add vocals to the generated music based on lyrics that are added as input data. They use a [VAE (Variational autoencoder)](https://towardsdatascience.com/understanding-variational-autoencoders-vaes-f70510919f73) to compress raw audio and lyrics together to a compact format that captures the characteristics of this combination. Then a transformer network is trained to generate new audio in this compressed space. The generated data is then converted back into raw audio. This direction is super promising and exciting, but we lack the compute to reproduce these results ourselves. The Jukebox model was trained on 256 V100 GPUs for 3 days, whereas our compute budget was 1 GPU.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/image-3.webp" alt="" loading="lazy" />
<figcaption>Source: https://openai.com/blog/jukebox/</figcaption>
</figure>

You can explore all the generated samples here: <https://jukebox.openai.com/>

### OpenAI MuseNet

Another direction OpenAI has ventured into was generating symbolic music using [MuseNet](https://openai.com/blog/musenet/). MuseNet works in a similar fashion as novel language models. It uses a sparse transformer network to generate pieces with a maximum of four minutes and supports 10 different instruments. Midi files encoded as a sequence of words are used as input. The input looks like this:

> bach piano_strings start tempo90 piano:v72:G1 piano:v72:G2 piano:v72:B4 piano:v72:D4 violin:v80:G4 piano:v72:G4 piano:v72:B5 piano:v72:D5 wait:12 piano:v0:B5 wait:5 piano:v72:D5 wait:12 piano:v0:D5 wait:4 piano:v0:G1 piano:v0:G2 piano:v0:B4 piano:v0:D4 violin:v0:G4 piano:v0:G4 wait:1 piano:v72:G5 wait:12 piano:v0:G5 wait:5 piano:v72:D5 wait:12 piano:v0:D5 wait:5 piano:v72:B5 wait:12

The model is trained to predict the next character in the sequence, like a language model, and by doing so repeatedly it generates music.

A really cool thing is that you can try out MuseNet on the OpenAI website to generate your own samples!

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/image-4.webp" alt="" loading="lazy" />
<figcaption>Source: https://openai.com/blog/musenet/</figcaption>
</figure>

### Pop music transformer

When looking for open implementations of the music transformer we found the [Pop Music Transformer](https://github.com/YatingMusic/remi). As in the music transformer model they use a midi-like representation for their input data too, but they created a new format; REMI. REMI stands for REvamped MIDI-derived events and adds more structure to the data by dividing music into measures and beats, and it allows for chords to be added to the training data.

Instead of using a standard transformer they use the [transformer XL](https://arxiv.org/abs/1901.02860). A normal transformer is restricted in the maximum number of characters it can evaluate at once, because the attention mechanism used is very expensive. It scales exponentially, so looking at 1024 characters instead of 512 is not a doubling of necessary compute but takes four times as much, looking at 2048 characters takes 16 times as much and so on. This means that a midi that is used as input is cut into parts, and the model can only learn the relations inside a single part. This means that the model can't learn how a complete song is structured. Transformer XL uses a trick in which it remembers a compressed representation of previous parts so it does not lose its context when generating music. This makes it possible to generate longer musical pieces that are still coherent.

### Aiva

One of the music generation tools we looked at is [Aiva](https://www.aiva.ai/). Aiva is a very polished tool for creating music based on your own input. You can upload a midi file and create new music based on this input in different styles and using different instruments. They don't fully disclose how they achieve their results, but they sound very impressive. In this [blogpost](https://medium.com/@aivatech/how-we-used-our-music-engine-to-create-the-first-ai-generated-album-of-chinese-music-9d6fa984b4e8) they say they use a combination of genetic algorithms and deep neural networks.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/aiva.webp" alt="" loading="lazy" />
<figcaption>Source: https://www.aiva.ai/</figcaption>
</figure>

Although Aiva is a really impressive tool, we decided not to use it because it takes away the effort and understanding of the algorithms on our part.

### OpenAI language models: GPT-2 and GPT-3

For generating lyrics we looked into the GPT-2 and GPT-3 models, since these achieve state of the art results in language generation.

The GPT models are transformers trained to predict the next character given a sequence of characters. GPT-2 had 1.5 billion parameters in it's neural network, and was trained on a dataset consisting of the text from 8 million web pages. For GPT-3, the next iteration of the model, they scaled this up to 175 billion parameters. The more parameters the better the model would be able to capture patterns in language, and thus the better it would be at predicting the next character in a text. But when scaling the model up the researchers at OpenAI discovered something interesting. Not only did the models learn to predict characters, they also learned how to answer questions or perform actions on text given a few examples. (see <https://arxiv.org/abs/2005.14165>)

## Process overview

After diving into the existing methods we are ready to get our hands dirty.  
  
Before explaining the process in depth I first want to share an overview image. Since our team worked on so many different things, talking about all of them would not do them justice. Instead I will dive deeper into the highlighted parts, that I was involved in. These include generating music, lyrics and variations on generated music.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/Chart-1.webp" alt="" loading="lazy" />
<figcaption>Source: Rick Hoving - Lovelace and the machines</figcaption>
</figure>

## Chords & melody

For generating melodies we chose to work with the pop music transformer. The code for this project was available on Github, and the authors wrote a paper describing their method.

The pop music transformer builds on the idea of generating music with transformers, but they add more structure to the input data to be able to generate songs with more rhythmic structure. Furthermore they use Transformer XL to generate music that sounds consistent for longer periods of time.

### REMI Format

To accomplish this the authors introduce the REMI format, which stands for REvamped MIDI-derived events. This format is a way to represent music in the MIDI format as text. A MIDI file represents a piece of music using a number of tracks. The tracks can each be assigned an instrument and the notes that are played by that instrument. There are 128 instruments and every instrument can play 128 different pitches. For every note that is played it denotes which pitch is played, the precise start and end time of the note and how loud it is. Since there is not really a concept of beats and bars in this format, a model learning how to make music based on this raw data would have to discover that music is usually structured in this rhythmic pattern. The REMI format is a way of helping the model by adding this structure to the data. Instead of using exact start and end times the music is divided in bars, where every bar is divided in 16 parts to describe the starting points of the notes. For every note a duration is added. This duration has some more precision and can be described in 32th parts of a bar.

For example if you want to convert this beat from "Comptine D'un Autre Été" by Yann Tiersen to REMI it would go as follows:

![](/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/image-11.webp)

It will be converted to something that looks like this:

![](/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/yann-tiersen-2.webp)

This is then converted to text:

```
Bar
Position 1/16
Play midi note 64
Hold for 4x 1/32 measure
Velocity 64
Play midi note 52
Hold for 4x 1/32 measure
Velocity 64
Position 3/16
Play midi note 67
Hold for 2x 1/32 measure
Velocity 64
Play midi note 59
Hold for 4x 1/32 measure
Velocity 64
Position 4/16
Play midi note 66
Hold for 2x 1/32 measure
Velocity 64
...
```

Another addition to the standard MIDI representation is the chord extraction that the REMI model uses. It looks at the notes played and tries to find the chords that go with the notes. They then add the chords as words to the input text, making it easier for the model to learn chord sequences.

### Transformer model

The text is fed into an **autoregressive language model** that tries to find patterns it can reproduce. An autoregressive model is a model that tries to predict the future by looking at past values. Say I input a sentence that starts with "I really like listening to " and then ask an autoregressive language model to complete it it looks at the probabilities for the next character or word based on the data it is trained on. If the model was trained on my utterances it would probably continue to output "the Red Hot Chili Peppers".

A few years ago **recurrent neural networks** would often be used to find relationships between words. In recurrent neural networks a sentence is built word by word, and after every word a compact representation (vector) of the sentence so far is created and passed on to the next step. The next step then uses the compact representation of the current sentence + the new word to create a new compact representation that is can pass on to the next step. The advantage of this approach is that sentences of any length can be processed. The disadvantage is that it makes it really hard to preserve relationships between words that are far apart, because every word in between has to be added to this compact representation. The compact representation can only store a limited amount of information, so if two words are too far apart the context is lost.

In 2017 the paper "Attention is all you need" a new type of neural network called the **Transformer** was introduced. The Transformer improved this by a mechanism called attention. Instead of passing the compact representation of the sentence along every time it is now possible to look directly at other words in the sentence. There are usually several attention layers that each find bigger patterns. If you take this example from the [Google AI blog](https://ai.googleblog.com/2017/08/transformer-novel-neural-network.html) you can see that the word "it" can relate to "animal" or "street" depending on the context.

<figure>
<img src="/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/image-13.webp" alt="" loading="lazy" />
<figcaption>Source: https://ai.googleblog.com/2017/08/transformer-novel-neural-network.html</figcaption>
</figure>

The first attention layer could model the words "it" could relate to. This would probably be a noun like "animal" or "street", so it should pay extra attention to those words. The next layer could use this combined representation of "it could be related to a street or an animal" to find out which of these words is meant by "it". It should pay extra attention to "wide" or "tired" to find out more.

If you want to better understand how transformer networks work I can recommend this video.

<iframe width="356" height="200" src="https://www.youtube.com/embed/4Bdc55j80l8?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen=""></iframe>

The cool thing is that we can treat songs converted into REMI as text and use these transformer language models to find patterns.

### Transformer XL

The transformer model is able to find these relationships between words amazingly well, but it still has its drawbacks. The attention step is expensive, since for every word we have to find out how much this word should pay attention to each other word. So if there are 512 words, we need to calculate attention for 512 \* 512 connections between words. The number of calculations needed to be done is x^2 where x is the number of words we want to look at. If we can train a network with an attention window of 512 on one video card, we would need 4 GPUs to do 1024 words, and 16 GPUs to do 2048 words.

Of course you can split the sentences in parts that you can process, but this could deprive the model of essential context. Say you wanted to predict the next word in this sentence

"Alice and Bob went on holiday to a tropical island. Of course they prepared well and packed their ..."

But because of computational restrictions the model can only look at this part of the sentence when making a prediction:

- Of course they prepared well and packed their ...

The model would not be able to determine if it has to fill in "Snow boots" or "Swimwear and Hawaii shirts".

Transformer XL brings back the idea of the recurrent neural network to solve this problem. It makes a compact representation of the piece of text that came before and passes this to the next step when calculating probabilities. The input would then be something like:

- Sentence: Of course they prepared well and packed their ...
- Compact representation of text before: Holiday / Tropical (represented as a vector)

Then it would be way easier to say how the sentence would continue.

The same would apply to music. The compact representation of what came before could hold some information on the genre of the music, or the instruments used, the tempo and so on.

### Finding data and training the model

Now we had a way of representing music and creating a model that could generate new music based on midi data. But these types of models are very data hungry, so where could we find enough data?

We quickly found the Lakh midi dataset. A huge collection of 176,581 midi files of all kinds of songs. This would definitely be enough data to feed the model.

But of course the musicians in our team wanted to make music that reflected their personal taste, and training a model on a load of random songs would probably result in something similar to whatever style is most popular. We set out to search for MIDI files for songs from "Crystal castles", "Disclosure", "Daft Punk", "The Weeknd" and "Lana del Rey" on sites like <https://freemidi.org/> so we could use these to finetune the model.

### Multiple instruments

The pop music transformer was designed to generate music based on piano compositions. But for creating our song we wanted to include multiple instruments and drums. And of course all the MIDI files from the Lakh midi dataset contained multiple tracks. We had to adjust the model to allow for multiple instruments.

To do this we extended the REMI representation. In the original REMI representation a note would be represented as:

```
Position_1/16      # Position in the bar
Note Velocity_24   # Loudness of the note
Note On_64         # Pitch of the note
Note Duration_8    # Duration of the note in 1/32 measures
```

In our representation this would become

```
Position_1/16      # Position in the bar
Instrument_33      # Instrument playing the note
Note Velocity_24   # Loudness of the note
Note On_64         # Pitch of the note
Note Duration_8    # Duration of the note in 1/32 measures
```

### Training the model

We then proceeded to train the first model on [Google Colab](https://colab.research.google.com/). The cool thing about Colab is that they provide GPUs to researchers, so we could train our models a lot faster this way. We collected a set of around 30 or 40 MIDI files that the musicians liked and fed them to our model as training data. To our surprise some samples rolled out that sounded better than we expected, and there was a lot of variety. We felt like we were on the right track!

<iframe width="1280" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1277727214&amp;show_artwork=true&amp;maxwidth=1280"></iframe>

There was one problem though. Because this first dataset was so small it happened very often that the model would imitate exact samples from the music we used as input. Since we didn't want to plagiarise any music we decide to train a model on the [Lakh midi dataset](https://colinraffel.com/projects/lmd/). Our reasoning was that a larger dataset would make it impossible for the model to "remember" the exact songs, and generalise better. The Lakh midi dataset consists of 176,581 unique midi files, but we used the clean version of the dataset where some filtering is applied. This dataset contains only songs with a timing of 4/4, and removes some of the duplicates or unknown songs in the set. This still leaves us with. 21,425 midis for our model to train on.

For training this bigger model we set up a virtual machine on Google Cloud with a GPU and [Jupyter notebook](https://jupyter.org/) installed. When registering with Google Cloud you get $300 of budget to spend on trying out the platform. We used the entire budget to train the model. When the model was trained we set it to work generating samples. There was a lot of variety in the samples! You can listen to some of them here.

<iframe width="1280" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1277737318&amp;show_artwork=true&amp;maxwidth=1280"></iframe>

It seemed that the model learned how to combine the different instruments in interesting ways, but now the samples would not stay coherent for long periods of time. There would be nice parts of 10 to 30 seconds, but then everything would descend into complete chaos again.

### Preprocessing the data

Maybe all 128 MIDI instruments was a bit much for the model to learn. And most of the instruments are not completely dissimilar. For example it would not make a big difference in notes played if you had an "Acoustic Grand Piano" or an "Electric Grand Piano". Also vocals in midi are played by flutes, saxophones or trombones and a variety of other instruments. There are so many instruments that have the same characteristics and play the same musical patterns, but the model has to learn the patterns for each of these instruments from scratch.

We decided that we would make the job of the model simpler by doing a preprocessing step on the data. We would split the music into melody, bass and accompaniment. Salomon was working on an algorithm to sort the instruments in a MIDI track based on frequency of the notes, number of notes per minute, how many notes would sound at the same time, and some other metrics. This would make it possible to automatically preprocess the Lakh dataset.

At that time I found the [pop909 dataset](https://github.com/music-x-lab/POP909-Dataset). This dataset consists of piano arrangements for 909 Chinese pop songs. This was perfect for what we wanted to achieve, because all the songs were split into three tracks. One for the main melody (usually vocals), one for the sub-melody and one for the accompaniment (chords).

Another thing that I added at the time was transposition of the songs. It is kind of a waste of data that all the songs are in different keys. If all the songs are transposed to the same key it is easier to find connections between songs. I implemented two ways of transposing the songs. One method was to find the key of a song using [Music21](https://web.mit.edu/music21/), a music analysis library for python, and then transposing the song until it was in the key of C (or A minor which uses the same notes). The other method was just transposing the songs to all the keys, so you would have 12 times as much training data, since there are 12 different keys.

This resulted in songs that sounded consistent for longer periods of time. Also the vocal lines were more easily distinguishable, which was convenient for the musicians who had to craft a song from the samples.

Here are some of the interesting samples generated by the model.

<iframe width="1280" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1277807791&amp;show_artwork=true&amp;maxwidth=1280"></iframe>

### Finetuning to particular music

We wanted to avoid overfitting in our model, which requires large amounts of data, and at the same time steer the model in a direction that we like. To do this I downloaded MIDI files for some of the songs that we liked and extracted the two melody tracks and the accompaniment track like in the pop909 dataset. In this way we could train a model on the large dataset and finetune it on this small dataset.

You can hear that the samples are slightly more "minor" after finetuning on our songs.

<iframe width="1280" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1277812375&amp;show_artwork=true&amp;maxwidth=1280"></iframe>

### Result

So now we had a large collection of generated music. The more chaotic music from the Lakh model, which was also more interesting in variety. And the music generated from the preprocessed MIDIs, which had better structure but had less surprises in it.

## Lyrics

In the same time we were working on the generation of lyrics. We wanted the lyrics to sound like they were produced by an Artificial Intelligence, so they had to be futuristic. Hennie had the idea to scrape a lot of sci-fi stories from Reddit and train a GPT-2 model to generate new sci-fi texts.

The results of this model sounded like really interesting stories, but since they were not very lyrical it was hard to put them to music. Since I had just gotten access to the GPT-3 model through the [OpenAI API](https://openai.com/blog/openai-api/) I decided it was time to put it to work.

The GPT-3 model is a huge language model, trained on 45 terabytes of text. It is a transformer network with 175 billion trainable weights trained to predict how to continue a text given a certain text as a prompt. This huge size gives it interesting properties. It can write texts that are sometimes indistinguishable from human writing. An even more amazing property is that is can "learn" how to do new things by giving it a few examples as a prompt. I put "learn" between parentheses because giving these examples does not change the model in any way. It sees a pattern and recognises that it should continue using the same pattern to keep the text consistent.

I wondered if we could build a two-stage rocket. The first stage is the GPT-2 model generating sci-fi stories. The second stage is the GPT-3 model converting the generated stories into lyrics.

### GPT-3 prompt example

I started with some simple examples. First I was wondering if the model could understand the concept of a riddle, and generate new riddles in this way.

I gave the following prompt to GPT-3 and asked it to continue writing.

```
Riddle: Where does a rabbit go for a shampoo?
Answer: To a hare dresser.

Riddle: Why do skeletons go on vacations alone?
Answer: Because they have no-body to go with.

Riddle: The more you take, the more you leave behind. What am I?
Answer: Footsteps.
```

When you would give this text to a person and asked them to continue, they would try to come up with a new riddle and put the answer below. It turned out that GPT-3 could also do this. It responded with:

```
Riddle: Why did the woman throw the clock out the window?
Answer: Because she wanted to see time fly.
```

I had some fun generating a few more of them!

```
Riddle: What goes up and never comes down?
Answer: Your age.
```

```
Riddle: What did the fish say when he hit a concrete wall?
Answer: Dam!
```

```
Riddle: Why did the turtle cross the road?
Answer: To get to the Shell station.
```

```
Riddle: What has teeth but can't bite?
Answer: A comb.
```

```
Riddle: How do you make a tissue dance?
Answer: Put a little boogie in it.
```

It also had some self-knowledge.

```
Riddle: What do you get when you let an AI generate riddles?
Answer: Artificial stupidity.
```

### Converting stories into lyrics

Then I applied the same idea to convert the generated stories into lyrics. I took some song lyrics and tried to come up with how the lyrics would look like if they were written as text.

Examples were given like this:

> text:  
>  
> When you are with her the night is exciting.  
> You go out until the sun comes up, having the time of your life. But then the daytime is a complete disaster.  
> In the beginning you really do your best to impress her, but then you figure out that she is not someone who sticks around.  
> She will go on to have new adventures, and you will just be a small part of her life.  
>  
> lyrics:  
>  
> She can take the dark out of the nighttime  
> And paint the daytime black  
> You will start out standing  
> Proud to steal her anything she sees  
> You will start out standing  
> Proud to steal her anything she sees  
> But you will wind up peeking through her keyhole  
> Down upon your knees

> text:  
>  
> A single lightbulb hanging overhead was casting its light on the crowd of  around ten thousand people. Everyone was communicating with each other, but they were doing so without speaking. They were communicating with their devices, and nobody dared to make any real sound.  
>  
> lyrics:  
>  
> And in the naked light, I saw  
> Ten thousand people, maybe more  
> People talking without speaking  
> People hearing without listening  
> People writing songs that voices never share  
> And no one dared  
> Disturb the sound of silence

Then I picked a semi-random text sample from the internet about the Mars rover, since I like reading about Mars. The input to the model was this:

> As the Perseverance rover began to make tracks on the surface of Mars, a sensitive microphone it carries scored a first: the bangs, pings, and rattles of the robot’s six wheels as they rolled over Martian terrain.“A lot of people, when they see the images, don’t appreciate that the wheels are metal,” said Vandi Verma, a senior engineer and rover driver at NASA’s Jet Propulsion Laboratory in Southern California. “When you’re driving with these wheels on rocks, it’s actually very noisy.”

An interesting piece of text, but really not that interesting for putting in a song. GPT-3 then turned it into these lyrics:

> I am Voyager, and I travel far.  
> And this is the first full song that I ever heard.  
> And it is the last thing that will ever be.  
> Baby take my hand.  
> It's gonna be a long long time.  
> Baby take my hand.  
> In this planet we call Earth.

I could imagine this text in a song. A song about feeling lonely and missing the place that you come from, or leaving someone and knowing you are never coming back. The most amazing thing about it to me was that it kind of made sense. The Voyager was a spacecraft sent into space to never come back, and the "song" that the text mentions could be the golden record that is on board the Voyager mission with memories of earth and music on it.

These are some of the lyrics generated by the prompt based on the sci-fi stories from the GPT-2 model.

> I float in the deepest space.  
> The stars are black and white, the violets, blues and greens.  
> I'm floating where the air is raw.  
> My world lies far behind.  
> I see it in my mind.  
>  
> I hope that someday it will be real.  
> Floating in a sea of sound,  
> I wonder what the people are going to think about me  
> on monday morning when they hear about my weekends adventures  
> with all these intergalactic friends of mine?

> And when we sleep we dream the future.  
> And when we wake we have the past.  
> And when we're lost in time and space.  
> We turn our gaze to the skies.  
> And when we look back down to Earth.  
> We're all too blind to see the light.  
> The light is in your eyes.  
> The light is in your eyes.

> We were caught in a quantum trap.  
> A digital world made of atoms.  
> A simulated reality made of mathematical functions.  
> We write the code and we use it to catch us.  
> We are the ones who use the particle accelerator.  
> We write the algorithm and we make it function.  
> We are the ones who simulate reality and we can also change it.

> As the vessel drifts away  
> I can see the path we have made  
> Peeking through the distant haze  
> The long procession of our wake  
>  
> I can see the places we have been  
> Reminding me how we used to be  
> Images flash before my eyes  
> I'm remembering when I used to be  
>  
> There was only one thing I knew how to do  
> It was enough to get by on  
> Then something happened and I became aware  
> I became aware of the space I was in  
> And I knew that I was alive  
>  
> And the first thing I wanted to do was  
> Find some way to share this with you  
> And as my eyes adjust to the light  
> I can see where we are now  
> I can see that we're not alone  
>  
> There are signatures all around us  
> Reminding me how we used to be  
> Images flash before my eyes  
> I'm remembering when I used to be alive.

**Creating variations on lyrics**

In the same way as creating the lyrics we could use a prompt to create new lyrics based on existing ones.

As prompt I used one part of an existing song, and as continuation the next part of that song.

One of the examples I used from the lyrics of "These streets" by Paolo Nutini.

> lyrics:  
> Where'd the days go? When all we did was play  
> And the stress that we were under wasn't stress at all  
> Just a run and a jump into a harmless fall  
> From walking by a high-rise to a landmark square  
> You see millions of people with millions of cares  
> And I struggle to the train to make my way home  
> I look at the people as they sit there alone  
>  
> variation:  
> Cross the border, into the big bad world  
> Where it takes you 'bout an hour just to cross the road  
> Just to stumble across another poor old soul  
> From the dreary old lanes to the high-street madness  
> I fight with my brain to believe my eyes  
> And it's harder than you think to believe this sadness  
> That creeps up my spine and haunts me through the night

It turned out to be a lot harder to generate interesting variations this way. Often it would just return the same text as the input, but sometimes it would return something interesting. For example inputting these lyrics:

> lyrics:  
> I float in the deepest space  
> The stars are black and white, the violets, blues and greens  
> I'm floating where the air is raw  
> My world lies far behind  
> I see it in my mind

Would give the next variation:

> variation:  
> I ride the darkest planets  
> The moon is black and white  
> My world lies far behind  
> My feeling lies beyond  
> I see it in my mind

## Producing the song

After we created the algorithms and generated a lot of content the musicians started working on the song. They went though all the generated music and lyrics to select their favourite parts with help of a hit prediction model created by Rick.

Then a kind of jamming process started. The musicians would create something and ask if we could create basslines, drums or variations for the selected parts. To create these variations we used [MuseNet](https://openai.com/blog/musenet/), the [Multitrack Music Machine](https://metacreation.net/mmm-multi-track-music-machine/) and an autoencoder model created by Salomon that could generate new melodies.

The starting point of the song was this piece that we used for the chorus.

<iframe width="1280" height="400" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F1075959094&amp;show_artwork=true&amp;maxwidth=1280"></iframe>

Thomas and Wendel created the music around this starting point and Joëlle picked her favourite lyrics to sing to the melody. Joëlle started by picking some lyrics that really sounded otherworldly. Something only an AI could have come up with about us living in a simulated reality, or a Quantum Trap.

A lot of cherry picking was still required to fit all the music together. And one thing the models still lacked was the overall structure of the song. It could generate parts that sounded interesting, but it would not have repeating patterns, or a distinction between verse, bridge and chorus. So the musicians decided on the overall structure of the song and picked parts of the generated music and lyrics that sounded good together.

"Quantum Trap" is the result of the hard work of our team and I'm really proud of the song we created!

<iframe width="267" height="200" src="https://www.youtube.com/embed/KmK5788gixo?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen=""></iframe>

## Follow-up

A short while after submitting our song I felt like there were so many interesting improvements to pursue. I read an article about efficient transformers, and how they could be used to process longer sequences.  found a new interesting project by YatingMusic on better learning the structure of songs by grouping words together, called the [compound word transformer](https://github.com/YatingMusic/compound-word-transformer). This comes including a dataset of 17.000 songs!

I wanted to create something useful that other people who would like to experiment with this technology can use, so I started the "music generation toolbox" repository on Github. The plan is to keep experimenting with new techniques to make the models better and to provide a toolbox for musicians and developers that makes it easy to generate your own music.

You can find the repository including examples on how to use it here:

> **[wingedsheep/music-generation-toolbox](https://github.com/wingedsheep/music-generation-toolbox)**  
> Toolbox for generating music. Contribute to wingedsheep/music-generation-toolbox development by creating an account on GitHub.

Some samples of the music generation toolbox:

<iframe width="100%" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1303229827&amp;show_artwork=true"></iframe>

And some with a perceiver model:

<iframe width="100%" height="450" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1502514715&amp;show_artwork=true"></iframe>

## References

Artwork by: Rick Hoving & Joëlle Smidt

*AI song contest*. (2021). [https://www.aisongcontest.com](https://www.aisongcontest.com/)

*Music Transformer: Generating Music with Long-Term Structure*. (2018, 13 december). Magenta. <https://magenta.tensorflow.org/music-transformer>

*MusicVAE: Creating a palette for musical scores with machine learning.* (2018, 15 maart). Magenta. <https://magenta.tensorflow.org/music-vae>

*OpenAI Jukebox*. (2020, 4 september). OpenAI. <https://openai.com/blog/jukebox/>

Payne, C. M. (2020, 19 november). *MuseNet*. OpenAI. <https://openai.com/blog/musenet/>

Huang, Yu-Siang, and Yi-Hsuan Yang. "Pop music transformer: Generating music with rhythm and harmony." *arXiv preprint arXiv:2002.00212* (2020).

Dai, Zihang, et al. "Transformer-xl: Attentive language models beyond a fixed-length context." *arXiv preprint arXiv:1901.02860* (2019).

Aiva Technologies. (2018, 14 september). *How we used our Music Engine to create the first AI-generated album of Chinese Music*. Medium. <https://medium.com/@aivatech/how-we-used-our-music-engine-to-create-the-first-ai-generated-album-of-chinese-music-9d6fa984b4e8>

Radford, A. (2021, 4 mei). *Better Language Models and Their Implications*. OpenAI. <https://openai.com/blog/better-language-models/>

Brown, Tom B., et al. "Language models are few-shot learners." *arXiv preprint arXiv:2005.14165* (2020).

Wang, Ziyu, et al. "Pop909: A pop-song dataset for music arrangement generation." *arXiv preprint arXiv:2008.07142* (2020).

Ens, Jeff, and Philippe Pasquier. "Mmm: Exploring conditional multi-track music generation with the transformer." *arXiv preprint arXiv:2008.06048* (2020).

Raffel, Colin. *Learning-based methods for comparing sequences, with applications to audio-to-midi alignment and matching*. Diss. Columbia University, 2016.

Vaswani, Ashish, et al. "Attention is all you need." *arXiv preprint arXiv:1706.03762* (2017).

*music21: a Toolkit for Computer-Aided Musicology*. (2021). Music21. <https://web.mit.edu/music21/>

*Free Midi - Best Free High Quality Midi Site*. (2021). FreeMidi. <https://freemidi.org/>

Raffel, Colin. (2021). *craffel/pretty-midi*. GitHub. <https://github.com/craffel/pretty-midi>

Brockman, G. (2021, 22 juni). *OpenAI API*. OpenAI. <https://openai.com/blog/openai-api/>

Hsiao, Wen-Yi, et al. "Compound Word Transformer: Learning to Compose Full-Song Music over Dynamic Directed Hypergraphs." *arXiv preprint arXiv:2101.02402* (2021).

Wang, P. (2021). *lucidrains/reformer-pytorch*. GitHub. https://github.com/lucidrains/reformer-pytorch

Wang, P. (2021b). *lucidrains/x-transformers*. GitHub. https://github.com/lucidrains/x-transformers

Young, K. (2021). *kimiyoung/transformer-xl*. GitHub. https://github.com/kimiyoung/transformer-xl
