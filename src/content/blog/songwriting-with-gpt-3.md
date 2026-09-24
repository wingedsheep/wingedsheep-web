---
title: "GPT-3 as a muse: generating lyrics"
date: 2022-04-22
excerpt: "Using a finetuned version of GPT-3 to write lyrics in the preferred style."
tags: ["Music Generation", "GPT-3"]
cover: "/blog/songwriting-with-gpt-3/cover.webp"
shelf: music
---

## Introduction

Ever since I started playing guitar some 10 years ago I dreamt of writing a song of my own someday that I can be proud of. Sometimes a nice melody or chord progression pops into my head, but somehow the lyrics that I write always feel a bit uninspired.

Then I joined a team for the [AI Song Contest in 2021](/blog/music-generation-creating-a-song-for-the-ai-song-contest-2021/), and we wrote a complete song with the help of AI. We had a process of turning sci-fi stories into lyrics using GPT-3 prompting. This resulted in pretty bizarre, but very interesting lyrics. However I felt this method lacked a feeling of control. I wanted to be able to influence the style of the music, the mood and the topic the song was written about. So I continued the lyrics generation project.

In this blogpost I will explain different techniques I used to generate lyrics with the help of GPT-3.

- Generating lyrics using prompts
- Generating lyrics using a finetuned GPT-3 model
- Creating variations for existing lyrics
- Conclusion.

## Generating lyrics using prompts

GPT-3 is created to finish a text given a certain input. These text inputs are also called prompts. The easiest way to use this model is to write a prompt that triggers the model into writing the text you want. For example, if you want the model to write a good joke, you could prompt it with the following text: "A very funny joke:". Prompting works better when you give some examples of what you want first, so GPT-3 can use the pattern in your examples to figure out what you want to achieve.

I first prompted the model without giving it any examples, to write a song about following your dreams. Bold text is the prompt, and normal text is the output that GPT-3 generated.

Write a song about the following subject: "The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true."
  
  
Lyrics:
  
  
Don't be afraid of your dreams,  
Even if you're afraid of what they may represent.  
They can be seen as a place of potential growth and change.  
And I assure you, your dreams are still alive.  
You have the power to make them come true.  
  
So don't give up on your dreams,  
Even if they seem out of reach.  
Believe in yourself and you will see,  
That anything is possible.  
  
Just keep on dreaming,  
And never let go of your hope.  
For one day, your dreams will come true.  
And you'll be everything you ever wanted to be.

The result is pretty much what I asked for, but it is very basic. There are no metaphors, and the subject is almost copied literally into the lyrics. But the cool thing is that GPT-3 understood that a song should consist of different verses.

To generate more lyrical results I tried adding some examples to the prompt, in the hope that this would make the lyrics a bit more poetic. This allows GPT-3 to mimic the structure of the examples in the generated text. The prompt with examples is structured as follows

```text
description: example description 1
lyrics: example lyrics 1
<--->
description: example description 2
lyrics: example lyrics 2
<--->
description: example description 3
lyrics: example lyrics 3
<--->
description: description for the new song to be generated
lyrics:
```

In between the examples I added a divider, to make it easier for the model to understand the structure I am looking for.

To make it easier to prepare the examples we can also use GPT-3 to generate descriptions of lyrics, by prompting it with the lyrics and asking it to describe them. An example:

On bended knee is no way to be free  
Lifting up an empty cup, I ask silently  
That all my destinations will accept the one that's me  
So I can breathe  
  
Circles they grow and they swallow people whole  
Half their lives they say goodnight to wives they'll never know  
Got a mind full of questions and a teacher in my soul  
And so it goes  
  
Don't come closer or I'll have to go  
Owning me like gravity are places that pull  
If ever there was someone to keep me at home  
It would be you  
  
Everyone I come across in cages they bought  
They think of me and my wandering but I'm never what they thought  
Got my indignation but I'm pure in all my thoughts  
I'm alive  
  
Wind in my hair I feel part of everywhere  
Underneath my being is a road that disappeared  
Late at night I hear the trees they're singing with the dead  
Overhead  
  
Leave it to me as I find a way to be  
Consider me a satellite forever orbiting  
I knew all the rules but the rules did not know me  
Guaranteed  
  
What do the above lyrics mean to you? Explain some of the metaphors.  
  
The lyrics of this song are about a person who feels out of place in the world. They feel like they don't fit in with the society that they live in and that they don't really have a place to call home. The lyrics also express the idea of being free. The person singing the song wants to be free to explore the world and find their place in it. The lyrics also contain metaphors about life and the world. For example, the lyrics say that "everyone I come across in cages they bought." This is a metaphor for the way that people are restricted by the rules and limitations of society.

The GPT-3 API has a temperature slider that controls how much randomness to allow. Temperature 0 means no randomness is allowed, and only the most probable characters are selected. A temperature of 1.0 is the highest and means a lot of randomness is allowed. This creates more interesting twists in the text, but also makes the texts more chaotic. The default value for temperature is 0.7. I found that increasing this value to 0.8 meant that the generated lyrics were a bit more interesting and poetic.

The following lyrics are created using the same prompt, but with three examples and a temperature value of 0.8 instead of 0.7. The examples are the songs

- Walk away by Franz Ferdinand
- Guaranteed by Eddie Vedder
- Universally Speaking by the Red Hot Chilli Peppers

(3 examples)  
<--->  
description:The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
lyrics:  
  
Dreams are like stars  
You may never touch them  
But if you follow them  
They will lead you to your destiny  
  
And when it gets dark  
And you can't see your way  
Just hold on to the starlight  
And don't be afraid  
  
Your dreams are still alive  
And you have the power to make them come true  
Just believe in yourself  
And don't be afraid to follow your heart  
  
When the world is at its darkest  
And you feel like you can't go on  
Just hold on to the starlight  
And don't be afraid  
  
Your dreams are still alive  
And you have the power to make them come true  
Just believe in yourself  
And don't be afraid to follow your heart  
  
Dreams are like stars  
You may never touch them  
But if you follow them  
They will lead you to your destiny  

For the next lyrics I added two more example songs and adjusted the temperature to 0.9, to make the lyrics even more imaginative.

The example songs added are:

- Sunsets for somebody else by Jack Johnson
- The hardest part by Coldplay

(5 examples)  
<--->  
description:The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
lyrics:  
  
Don't be afraid of your dreams  
Even if they're made of stone  
There's beauty in what they mean  
Even if they're not your own  
  
Your dreams are still alive  
Even if you don't believe  
You have the power to make them come true  
So don't be afraid to dream  
  
Don't be afraid of the dark  
Even if it seems so cold  
There's light in what it holds  
And you can find your way back home  
  
Your dreams are still alive  
Even if you don't believe  
You have the power to make them come true  
So don't be afraid to dream  
  
Don't be afraid to be different  
Even if it's not the norm  
It's okay to be unique  
And be proud of who you are  
  
Your dreams are still alive  
Even if you don't believe  
You have the power to make them come true  
So don't be afraid to dream  
  
Your dreams are still alive  
And you have the power to make them come true  
So don't be afraid to dream  

It seems that GPT-3 understood the concept of verses now, and it even starts to rhyme a little. See the first verse where "dream" rhymes with "mean", and "stone" rhymes with "own".

There maximum length of prompt and output in the latest GPT-3 model is 4000 characters, and this prompt with output uses up a little over 2000 characters. So I will add two more examples to see if there is more improvement.

The songs added are:

- Stop this train by John Mayer
- Dream catch me by Newton Faulkner

(7 examples)  
<--->  
description:The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
lyrics:  
  
Dreams are like stars  
You may never touch them  
But if you follow them  
They will lead you to your destiny  
  
And when it gets dark  
And you can't see your way  
Just hold on to the light inside you  
And don't be afraid  
  
Don't be afraid  
To dream a little bigger, darling  
To shine a little brighter  
Don't be afraid  
To let your heart get broken  
You'll find happiness  
If you keep on dreaming  
  
Dreams are made for chasing  
So don't let them pass you by  
And when you're feeling lost  
Just hold on to the love you have inside  
And never give up  
  
Never give up  
On your dreams, no matter how impossible they seem  
Keep on believing  
And they will come true  
  
And when it gets dark  
And you can't see your way  
Just hold on to the light inside you  
And don't be afraid  
  
Don't be afraid  
To dream a little bigger, darling  
To shine a little brighter  
Don't be afraid  
To let your heart get broken  
You'll find happiness  
If you keep on dreaming  
  
Dreams are made for chasing  
So don't let them pass you by  
And when you're feeling lost  
Just hold on to the love you have inside  
And never give up  
  
Never give up  
On your dreams, no matter how impossible they seem  
Keep on believing  
And they will come true  

Interestingly if you prompt GPT-3 to answer questions and add "Let's think step by step" the accuracy of the answers increases by a lot.

> Here's the leaderboard of prompts to add to GPT-3.  
> Can you guys come up with anything better? <https://t.co/bGnBroMdR5> [pic.twitter.com/a3JCdUjlYu](https://t.co/a3JCdUjlYu)
>
> — Aran Komatsuzaki (@arankomatsuzaki) [May 25, 2022](https://twitter.com/arankomatsuzaki/status/1529285884817707008?ref_src=twsrc%5Etfw)

We can do something similar by adding tags like [Verse], [Verse variation], [Chorus] and [Bridge] to the examples. This makes the model "think" of the structure of the song, because it has to add a tag before each part. An added benefit is that the tags give you more control over the structure of the generated song. If you want to add another verse you can simply add a [Verse variation] tag, and see what the generator fills in.

An example of a song generated with added tags.

(5 examples with added tags)  
<--->  
description:The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
lyrics:  
  
[First verse]  
Don't be afraid of your dreams  
Even if they seem too wild  
There's something inside of them  
That's worth fighting for  
  
[Verse variation]  
And don't be afraid of the dark  
Even if it seems too vast  
There's something inside of it  
That's worth reaching for  
  
[Chorus]  
So hold on to your dreams  
And don't let go  
Believe in yourself  
And you'll make them come true  
  
[Verse variation]  
And don't be afraid of tomorrow  
Even if it seems too far  
There's something inside of it  
That's worth working for  
  
[Chorus]  
Just hold on to your dreams  
And don't let go  
Believe in yourself  
And you'll make them come true  
  
[Verse variation]  
And don't be afraid to be different  
Even if it makes you stand out  
There's something inside of you  
That's worth being proud  
  
[Chorus]  
Just hold on to your dreams  
And don't let go  
Believe in yourself  
And you'll make them come true  

## Generating lyrics using a finetuned GPT-3 model

Another way to introduce more of the desired lyrical structure and poetic quality into the generated texts is to fine-tune a model using the [OpenAI API](https://beta.openai.com/docs/guides/fine-tuning).

An important decision is the structure of the data you want to fine-tune the model on. I wanted to have control over the output of the generated songs by providing a description, name and bio of an artist, a mood and a song title. Using this method you have a lot of control over the generated lyrics. In addition to control over the subject of the song, you can decide to generate songs in the style of a given artist, and decide if it should be a happy or a sad song.

In the documentation they recommend that you should provide at least 500 examples for a good quality fine-tuned model. It is a lot of work to write song descriptions and bio's for at least 500 songs, so I created a python script to generate some of the data for me. As input I would provide just the artist name, the song title and the lyrics. The python script would call the OpenAI api to append the json with an artist bio, mood and a description of the provided lyrics. This is done using just the GPT-3 davinci model and a simple prompt.

The prompt for generating the lyrical description is as follows:

```text
{lyrics}

How would you describe the meaning of the above lyrics? Describe some of the metaphors.
```

The prompt for generating the artist bio's:

```text
Write a short bio for {artist}. What is the spirit of their music, their genre, and how would you describe their personality?
```

The prompt for describing the mood of the lyrics:

```text
{lyrics}

What is the mood of the above lyrics?

The mood is
```

An example of the output generated by this script. The "bio", "description" and "mood" fields are filled using GPT-3.

artist: Eddie Vedder,  
title: Guaranteed,  
lyrics: On bended knee is no way to be free  
Lifting up an empty cup, I ask silently  
That all my destinations will accept the one that's me  
So I can breathe  
  
Circles they grow and they swallow people whole  
Half their lives they say goodnight to wives they'll never know  
Got a mind full of questions and a teacher in my soul  
And so it goes  
  
Don't come closer or I'll have to go  
Owning me like gravity are places that pull  
If ever there was someone to keep me at home  
It would be you  
  
Everyone I come across in cages they bought  
They think of me and my wandering but I'm never what they thought  
Got my indignation but I'm pure in all my thoughts  
I'm alive  
  
Wind in my hair I feel part of everywhere  
Underneath my being is a road that disappeared  
Late at night I hear the trees they're singing with the dead  
Overhead  
  
Leave it to me as I find a way to be  
Consider me a satellite forever orbiting  
I knew all the rules but the rules did not know me  
Guaranteed  
  
Bio: Born December 23, 1964, in Evanston, Illinois, Eddie Vedder is a singer, songwriter, and musician who is best known as the lead vocalist and one of three guitarists for the alternative rock band Pearl Jam. He is also a member of the band Temple of the Dog, and has released three solo albums.  
  
Vedder's music is often characterized as introspective and emotional, and his lyrics often deal with topics such as love, loss, and social and political injustice. He is known for his powerful vocal range and his passionate delivery. He is also known for his intense stage presence and for his intense dedication to his fans.  
  
Description: The lyrics of this song are about a person who feels out of place in the world. They feel like they don't fit in with the society that they live in and that they don't really have a place to call home. The lyrics also express the idea of being free. The person singing the song wants to be free to explore the world and find their place in it. The lyrics also contain metaphors about life and the world. For example, the lyrics say that "everyone I come across in cages they bought." This is a metaphor for the way that people are restricted by the rules and limitations of society.  
  
Mood: The mood of the lyrics is hopeful and defiant. The speaker is asking for freedom, and they are determined to find their own way despite the obstacles in their life.

Using descriptions like this for 500 songs I fine-tuned a GPT-3 Davinci model. The Davinci model is the largest and most capable of the [GPT-3 models](https://beta.openai.com/docs/engines/gpt-3) available. The larger the model, the more emergent capabilities appear. For example, the smallest model can do things like parsing text, simple classification, address correction, coming up with keywords. Capabilities like summarizing text, finding out cause and effect, and creativity only appear in the larger models. Fine-tuning a model like that for 2 epochs took just a few minutes and cost around $20.

This is a subset of my fine-tuning file, containing 4 out of the 500 songs I used for the model. It should be in json lines format, which is one json per line. Note that \n\n###\n\n is used to indicate this is where the completion starts, and <!> is used to indicate the end of the lyrics. It can be used as a stop condition when generating lyrics.

```jsonl
{"prompt": "artist: Black Keys\nbio: The Black Keys are an American rock band formed in Akron, Ohio, in 2001. The group consists of Dan Auerbach (guitar, vocals) and Patrick Carney (drums). The band's raw blues-rock sound draws heavily from Auerbach's guitar playing and Carney's minimalist drumming. Although they have been compared to other garage rock revivalists such as the White Stripes and the Strokes, the Black Keys have a more soulful and vintage sound.\ndescription: The lyrics are about someone offering to be a constant source of support and guidance for another person.\nmood: The mood is hopeful and reassuring\n\n###\n\n", "completion": " [Everlasting light]\n\nLet me be your everlasting light\nThe sun when there is none\nI'm a shepherd for you\nAnd I'll guide you through\nLet me be your everlasting light\n\nLet me be your everlasting light\n(Shoo-shoo-shoo-wa)\nI'll hold and never scold\n(Shoo-shoo-shoo-wa)\nIn me you can confide\nWhen no one's by your side\nLet me be your everlasting light\n(Shoo-shoo-shoo-wa)\n\nOh baby, can't you see\nIt's shinin' just for you\nLoneliness is over\nDark days are through\nThey're through\n(Shoo-shoo-shoo-shoo-shoo-shoo-shoo-wa)\n\nLet me be your everlasting light\n(Shoo-shoo-shoo-wa)\nA train goin' 'way from pain\n(Shoo-shoo-shoo-wa)\nLove is the coal\nThat makes this train roll\nLet me be your everlasting light\nYeah\n\nLet me be your everlasting light\nLet me be your everlasting light\nLet me be your everlasting light\nOhh...<!>"}
{"prompt": "artist: Arctic Monkeys\nbio: Arctic Monkeys is an English rock band formed in Sheffield in 2002. The group consists of Alex Turner, Matt Helders, and Nick O'Malley. The band's debut album, Whatever People Say I Am, That's What I'm Not, was released in 2006 and became the fastest-selling debut album by a band in UK chart history. The band's second album, Favourite Worst Nightmare, was released in 2007. The band's third album, Humbug, was released in 2009. The band's fourth album, Suck It and See, was released in 2011. The band's fifth album, AM, was released in 2013. The band's sixth album, Tranquility Base Hotel & Casino, was released in 2018.\ndescription: The lyrics of the song seem to be criticizing the pretentiousness of some people in the indie music scene. The singer is talking about how some people try to act like they are from San Francisco or New York City, when they are actually from much smaller towns. They also seem to be making fun of how some people in the scene try to act like they know everything about music, when they really don't.\nmood: The mood is one of disdain and mockery\n\n###\n\n", "completion": " [Fake tales of san francisco]\n\nFake Tales of San Francisco\nEcho through the room\nMore point to a wedding disco\nWithout a bride or groom\n\nThere's a super cool band yeah\nWith their trilbies and their glasses of white wine\nAnd all the weekend rock stars in the toilets\nPracticing their lines\n\nI don't want to hear you\n(Kick me out, kick me out)\nI don't want to hear you no\n(Kick me out, kick me out)\nI don't want to hear you\n(Kick me out, kick me out)\nI don't want to hear you\nI don't want to hear your\n\nFake Tales of San Francisco\nEcho through the air\nAnd there's a few bored faces at the back\nAll wishing they weren't there\n\nAnd as the microphone squeaks\nA young girl's telephone beeps\nYeah she's dashing for the exit\nOh, she's running to the streets outside\n\"Oh you've saved me,\" she screams down the line\n\"The band were fucking wank\nAnd I'm not having a nice time\"\n\nI don't want to hear you\n(Kick me out, kick me out)\nI don't want to hear you no\n(Kick me out, kick me out)\nYeah but his bird said it's amazing, though\nSo all that's left\nIs the proof that love's not only blind but deaf\n\nHe talks of San Francisco, he's from Hunter's Bar\nI don't quite know the distance\nBut I'm sure that's far\nYeah, I'm sure it's pretty far\n\nYeah, I'd love to tell you all my problem\nYou're not from New York City, you're from Rotherham\nSo get off the bandwagon, and put down the handbook\nYeah, yeah, yeah, yeah, yeah\n\nGet off the bandwagon and put down the handbook\nGet off the bandwagon and put down the handbook\nGet off the bandwagon and put down the handbook\nGet off the bandwagon and put down the handbook, yeah<!>"}
{"prompt": "artist: Coldplay\nbio: Coldplay is a British rock band formed in 1996 by lead vocalist and pianist Chris Martin and lead guitarist Jonny Buckland at University College London. After they formed under the name Pectoralz, Guy Berryman joined the group as a bassist and they changed their name to Starfish. Will Champion joined as a drummer and backing vocalist, completing the lineup. Coldplay achieved worldwide fame with the release of their single \"Yellow,\" followed by their debut album, Parachutes (2000), which was nominated for the Mercury Prize.\ndescription: The lyrics seem to be about wanting a simple, down-to-earth love, without any pretence or artifice. The speaker is tired of reading about mythical heroes with superhuman gifts, and instead wants something (and someone) more real and relatable.\nmood: The mood is romantic and longing\n\n###\n\n", "completion": " [Something like this]\n\nI've been reading books of old\nThe legends and the myths\nAchilles and his gold\nHercules and his gifts\nSpiderman's control\nAnd Batman with his fists\nAnd clearly I don't see myself upon that list\n\nBut she said, \"Where'd you wanna go?\nHow much you wanna risk?\nI'm not looking for somebody\nWith some superhuman gifts\nSome superhero\nSome fairytale bliss\nJust something I can turn to\nSomebody I can kiss\nI want something just like this\"\n\nDoo-doo-doo, doo-doo-doo\nDoo-doo-doo, doo-doo\nDoo-doo-doo, doo-doo-doo\nOh, I want something just like this\nDoo-doo-doo, doo-doo-doo\nDoo-doo-doo, doo-doo\nDoo-doo-doo, doo-doo-doo\n\nOh, I want something just like this\nI want something just like this\n\nI've been reading books of old\nThe legends and the myths\nThe testaments they told\nThe moon and its eclipse\nAnd Superman unrolls\nA suit before he lifts\nBut I'm not the kind of person that it fits\n\nShe said, \"Where'd you wanna go?\nHow much you wanna risk?\nI'm not looking for somebody\nWith some superhuman gifts\nSome superhero\nSome fairytale bliss\nJust something I can turn to\nSomebody I can miss\nI want something just like this\nI want something just like this\"\n\nOh, I want something just like this\nDoo-doo-doo, doo-doo-doo\nDoo-doo-doo, doo-doo\nDoo-doo-doo, doo-doo-doo\nOh, I want something just like this\nDoo-doo-doo, doo-doo-doo\nDoo-doo-doo, doo-doo\nDoo-doo-doo, doo-doo-doo\n\nWhere'd you wanna go?\nHow much you wanna risk?\nI'm not looking for somebody\nWith some superhuman gifts\nSome superhero\nSome fairytale bliss\nJust something I can turn to\nSomebody I can kiss\nI want something just like this\n\nOh, I want something just like this\nOh, I want something just like this\nOh, I want something just like this<!>"}
{"prompt": "artist: Counting crows\nbio: Counting Crows is an American rock band from Berkeley, California, formed in 1991. The band consists of Adam Duritz (lead vocals, piano), David Bryson (guitar), Charlie Gillingham (keyboards, piano, accordion), Dan Vickrey (guitar), David Immerglück (guitar, banjo, mandolin), Matt Malley (bass) and Jim Bogios (drums). Counting Crows gained popularity following the release of their debut album, August and Everything After, in 1993. Their hit single, \"Mr. Jones\", peaked at number five on the Billboard Hot 100. The band's influences include Van Morrison, R.E.M., Bob Dylan, and The Band.\n\nThe spirit of Counting Crows' music is one of melancholy and introspection, with Duritz's lyrics often focusing on relationships and heartbreak. The band's musical style has been described as a mix of alternative rock, pop, folk, and country. Counting Crows' personality has been described as laid-back and easy-going. The band is known for their live performances, which often feature extended jams and impromptu cover songs.\ndescription: The lyrics appear to be about a man who is planning to take a trip to Spain with a girl. He is leaving his old life behind him, and is looking forward to starting fresh in a new place. The lyrics could also be interpreted as being about a relationship that is coming to an end. The man is ready to move on, and is hoping to find someone new to start a new chapter with.\nmood: The mood is carefree and happy\n\n###\n\n", "completion": " [Holiday in spain]\n\nGot no place to go\nBut there's a girl waiting for me down in Mexico\nShe's got a bottle of tequila\nA bottle of gin\nAnd if I bring a little music I can fit right in\nWe've got airplane rides\nWe've got California drowning out the window side\nWe've got big black cars\nAnd we've got stories how we slept with all the movie stars\nI may take a holiday in Spain\nLeave my wings behind me\nDrink my worries down the drain\nAnd fly away to somewhere new\nHop on my choo-choo\nI'll be your engine driver in a bunny suit\nIf you dress me up in pink and white\nWe may be just a little fuzzy 'bout it later tonight\nShe's my angel\nShe's a little better than the one that used to be with me\n'Cause she liked to scream at me\nMan, it's a miracle that she's not living up in a tree\nI may take a holiday in Spain\nLeave my wings behind me\nDrive this little girl insane\nAnd fly away to someone new\nEverybody's gone\nThey left the television screaming that the radio's on\nSomeone stole my shoes\nBut there's a couple of bananas and a bottle of booze\n\nOh well, Happy New Year's, baby\nWe could probably fix it if we clean it up all day\nOr we could simply pack our bags\nAnd catch a plane to Barcelona 'cause this city's a drag\nI may take a holiday in Spain\nLeave my wings behind me\nFlush my worries down the drain\nAnd fly away to somewhere new\nTake a holiday in Spain\nLeave my wings behind me\nDrive this little girl insane\nFly away to someone new\nFly away to someone new\nFly away to someone new<!>"}
```

Let's see if the fine-tuned model is better at generating lyrics. Let's try generating lyrics in the style of a few different artists.

Because the model kept generating existing song title's for the artists, I created an extra prompt to generate these. The title generating prompt is very simple:

```text
Come up with an original title for a song about following your dreams by {artist}.
```

Below are some songs generated by prompting the fine-tuned model with different artists. I cherry picked the songs by generating up to 5 songs per prompt, and choosing my favourite.

---

"**Chasing After Dreams**", in the style of **Jack Johnson**.

artist: Jack Johnson  
bio: Jack Johnson is a professional surfer turned musician. He is best known for his mellow acoustic music, which has been dubbed "surf-rock." Johnson is a laid-back guy who likes to keep things simple. He is known for his eco-friendly lifestyle and his support of various charities.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Chasing After Dreams]  
  
Find your place amongst the stone  
And let it be your home  
Come and rest your weary bones  
The sky is waiting for your call  
  
Tiger lilies in the breeze  
Dance among the stars at night  
That's when all the children dream  
That they are something they are not  
  
"Oh, oh, oh"  
Don't be afraid  
"Oh, oh, oh"  
Don't be afraid  
  
We're chasing after dreams  
But our dreams are chasing us  
We're chasing after dreams  
But our dreams are chasing us  
  
And I'll be there to catch you  
As the music starts to play  
It is time to fire up those dreams  
The world is waiting for your call  
  
In a city of stone and steel  
Love can be your home  
Let it flow to where you're sleeping  
And you don't have to go alone  
  
"Oh, oh, oh"  
Don't be afraid  
"Oh, oh, oh"  
Don't be afraid  
  
We're chasing after dreams  
But our dreams are chasing us  
We're chasing after dreams  
But our dreams are chasing us  
  
And I'll be there to catch you  
As the music starts to play  
  
Dreams are dancing through the night  
We've got time to dream our lives away  
  
We're chasing after dreams  
But our dreams are chasing us  
We're chasing after dreams  
But our dreams are chasing us  
  
And I'll be there to catch you  
As the music starts to play  

I liked these lyrics a lot, so I added some chords and recorded a simple version of the song.

<iframe width="200" height="150" src="https://www.youtube.com/embed/fhPq9Jd61XA?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen=""></iframe>

---

"**The ghost of you**", in the style of the **Red Hot Chili Peppers**.

artist: Red Hot Chili Peppers  
bio: Formed in 1983, the Red Hot Chili Peppers are a funk rock band from Los Angeles, California. The band has achieved commercial success with their albums "Mother's Milk" (1989), "Blood Sugar Sex Magik" (1991), "One Hot Minute" (1995), "Californication" (1999), "By the Way" (2002), "Stadium Arcadium" (2006), and "I'm with You" (2011). The band's music is marked by its funk-inspired style, as well as by Anthony Kiedis' melodic vocals, John Frusciante's guitar solos, and Flea's basslines. The band is known for their energetic live performances and for drawing inspiration from a variety of musical styles.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[The Ghost of You]  
  
A hall of mirrors  
Chiseled from the will of stone  
You know the ghost of you  
Is always asking you to dance  
Begging you to come and play  
And the ghost of you  
Is the ghost of a dream  
Begging you to make it real  
  
Dreams are not afraid  
Of what they tell you  
Dreams are not afraid of what they say  
And the ghost of you  
Is the ghost of a dream  
That's as real as it can be  
  
You know the ghost of you's  
Surrounded by hungry wolves  
And even in the day  
When the wolves bust out the light  
You know the ghost of you  
Still wants to dance  
Still wants to play  
And the ghost of you  
Is the ghost of a dream  
Begging you to make it real  
  
Dreams are not afraid  
Of what they tell you  
Dreams are not afraid of what they say  
And the ghost of you  
Is the ghost of a dream  
That's as real as it can be  
  
I cut through the barbed wire  
That kept me from my heart  
And I showed you how brave I could be  
And it made me want to laugh  
The devil is a dictator  
And he knows that I'm not pure  
And I do what his music tells me to do  
And I do it 'til it hurts  
I do it 'til it hurts  
  
Dreams are not afraid  
Of what they tell you  
Dreams are not afraid of what they say  
And the ghost of you  
Is the ghost of a dream  
That's as real as it can be  
That's as real as it can be  
That's as real as it can be  

---

"**Find your way**", in the style of **John Mayer**

artist: John Mayer  
bio: John Mayer is a singer-songwriter whose music is a blend of pop, rock, and blues. He has a laid-back, easygoing personality, and his music reflects this. His songs are often about love and relationships, and he is known for his guitar skills.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Find your way]  
  
They tell you not to touch the fire  
And you know that if you get too close  
  
There's just a chance you might get burned  
But you have to step in the water  
At least get your feet wet  
'Cause you can't cross to the other side  
Unless you get your feet wet  
  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  
  
They tell you that your mountains  
Are too high to climb  
And you shouldn't even try  
But you gotta find your way  
On your own anyway  
'Cause there's no way to cross that river  
If you never try  
  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  
  
They tell you not to jump the fences  
And you know that if you go too far  
You might get stretched upon the rails  
But you have to go where the train tracks lead  
'Cause you can't cross to the other side  
Unless you get on the train  
  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  
  
You can't live your life over  
And there's no way to re-write history  
But you can make your future now  
And you can dream your dreams come true  
  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  
Dream on, dream on, dream on  
If it's too hard to sleep, then dream on  

---

"**Dreams of the remaining**", in the style of **Queens of the stoneage**

artist: Queens of the stoneage  
bio: Formed in 1996, Queens of the Stone Age is a rock band from Palm Desert, California, United States, formed by vocalist/guitarist Josh Homme. The band's line-up includes Homme, bassist Michael Shuman, guitarist Troy Van Leeuwen, and drummer Jon Theodore.
The band's sound has been described as stoner rock, hard rock, and heavy metal. Queens of the Stone Age is known for their heavy, riff-based sound, and their use of dynamic shifts in song structure and mood. The band's lyrics are often dark and cynical, dealing with topics such as drug addiction, violence, and betrayal.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Dreams of the remaining]  
  
In the jungle  
Where dreams breed  
There's a place where the soul takes a plunge  
Into the unknown  
Through the forest  
Where a heart can roam  
But the mind always knows  
  
To the desert  
Where the moon is high  
When the quiet comes  
And the wind blows  
To the sea  
Where the waters roll  
To the sky up above  
And the sea below  
  
And so the dreams  
That you have now  
May come true somehow  
In the dream  
Where you're yet to go  
And I know that it's so  
  
In the quiet  
Where the sun burns  
I'm watching you, you're watching me  
In the dawning  
When the stars turn  
And it's darker still  
  
We're running, we're laughing  
We're crying, we're singing  
We're dancing, we're fighting  
We're living all the same  
  
And so the dreams  
That you have now  
May come true somehow  
In the dream  
Where you're yet to go  
And I know that it's so  
  
And the dreams of the remaining  
Are still alive  
And they've got the power  
To make them come true  
Oh and they're alive  
They've got the power  
To make them come true  
Oh and they're alive  
They've got the power  
To make them come true  
  
The dreams of the remaining  
Are still alive  
And they've got the power  
To make them come true  
Oh and they're alive  
They've got the power  
To make them come true  
Oh and they're alive  
They've got the power  
To make them come true  

---

"**Clouds on the horizon**", in the style of **Franz Ferdinand**

artist: Franz Ferdinand  
bio: Franz Ferdinand are a Scottish rock band formed in 2002. The band's original lineup was composed of Alex Kapranos, Nick McCarthy, Bob Hardy, and Paul Thomson.
The band's music is often described as a mix of post-punk and indie rock, with influences ranging from new wave to disco. The band's persona is one of cool detachment, and their lyrics often deal with themes of love and loss.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Clouds on the Horizon]  
  
You'd better be dreaming of trees  
They are standing and growing  
If you believe in all you see  
While you're still half asleep  
  
Clouds on the horizon  
Dreams on the wind  
Clouds on the horizon  
Dreams on the wind  
  
Fear of what you see  
If you're afraid of what they mean  
You can change them again  
  
You won't even notice when  
  
Clouds on the horizon  
Dreams on the wind  
Clouds on the horizon  
Dreams on the wind  
  
You're not going nowhere  
  
Glitter, glamour and gold  
They are all around you  
If you lie that you own it  
You will only ever own nothing  
  
Clouds on the horizon  
Dreams on the wind  
Clouds on the horizon  
Dreams on the wind  
  
You're not going nowhere  
You are still on the same road  
You are not going nowhere  
You are still on the same road  
You're not going nowhere  

---

"**Chasing the sun**", in the style of **Muse**.

artist: Muse  
bio: Muse is an English rock band from Teignmouth, Devon, formed in 1994. The band consists of Matt Bellamy (lead vocals, guitar, piano), Chris Wolstenholme (bass guitar, backing vocals, keyboards) and Dominic Howard (drums). Muse's music is characterized by Matt Bellamy's operatic vocal style, as well as the band's use of experimental instrumentation and elaborate stage shows. Their personality could be described as ambitious, confident, and innovative.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Chasing the sun]  
  
If I could dream at all, I'd dream of you  
And in my sleep I'd hear you whisper near  
And the words you'd speak to me, oh they'd all be true  
Everytime I dream I dream of you  
  
I won't be afraid to close my eyes tonight  
For you sing to me in darkness, oh and light  
With you I know I will be safe tonight  
It's only darkness I can see  
  
It's chasing the sun  
It's chasing the sun  
It's chasing the sun  
It's chasing the sun  
  
The stars are turning red  
The shadows start to fall  
Oh, I could dream of you and wake believing  
That in all the world you'd care enough to come  
Dreaming, dreaming, all the while  
  
I won't be afraid to close my eyes tonight  
For you sing to me in darkness, oh and light  
With you I know I will be safe tonight  
It's only darkness I can see  
  
The night is falling  
Faster than you know  
It's chasing the sun  
It's chasing the sun  
It's chasing the sun  
It's chasing the sun  
  
I won't be afraid to close my eyes tonight  
For you sing to me in darkness, oh and light  
With you I know I will be safe tonight  
It's only darkness I can see  
  
I won't be afraid to close my eyes tonight  
For you sing to me in darkness, oh and light  
With you I know I will be safe tonight  
It's only darkness I can see  

---

"**A whirlwind of dreams**", in the style of **Coldplay**

artist: Coldplay  
bio: Coldplay is an English rock band formed in London in 1997. The band consists of Chris Martin (lead vocals, piano, guitar), Jonny Buckland (lead guitar), Guy Berryman (bass guitar), and Will Champion (drums, backing vocals, percussion).
Coldplay's music has been described as alternative rock, post-Britpop, and pop rock. The band's debut album, Parachutes, released in 2000, was met with critical acclaim. The band won a Brit Award for Best British Group in 2002. Coldplay has released seven studio albums in total; their latest album, A Head Full of Dreams, was released in December 2015.
The band's music is often characterized by its ethereal atmospheres and emotive lyrics, which have been compared to those of Radiohead. The band's frontman, Chris Martin, has been called "the last great romantic" in British music.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[A Whirlwind of Dreams]  
  
From me to you  
Everywhere on the breeze  
Wherever you may be  
You'll know exactly what to do  
  
When my eyes are closed  
And all my dreams are dead and gone  
Then maybe you will find  
Out where I've been  
  
So, I've been, I've been here all along  
I've been, I've been here all along  
  
From you to me  
Oh, what a beautiful place  
Wherever you may go  
You will never be alone  
  
Cause wherever you go  
And wherever you may be  
You've got a dream or two  
That's always alive  
  
So, I've been, I've been here all along  
I've been, I've been here all along  
I've been, I've been here all along  
I've been, I've been here all along  
  
I've been there all along...  
  
Sometimes we're afraid  
When we know what we want  
Sometimes we're afraid of our dreams  
  
From me to you  
Everywhere on the breeze  
Wherever you may be  
You'll know exactly what to do  
  
From you to me  
Oh, what a beautiful place  
Wherever you may go  
You will never be alone  
  
So, don't be afraid, I've been here all along  
I've been, I've been here all along  
I've been, I've been here all along  
I've been, I've been here all along  
I've been, I've been here all along  

---

To see if the model can also generate songs in a completely different style. Here is "**Don't you give up on me**", in the style of **Taylor Swift**.

artist: Taylor Swift  
bio: Taylor Swift is an American singer-songwriter. She is known for writing break-up songs and for her narrative songwriting. Her music has been described as country pop and her persona as relatable.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Don't You Give Up On Me]  
  
I'm living in a world  
Where everything's changing  
My friends disappear  
In distant places losing touch  
  
We've got problems  
That we just can't solve  
We've got money and power  
But when things go wrong  
We just keep on trying  
  
Don't you give up on me  
Don't you give up on me  
Don't you give up on me  
I won't give up on you  
  
Don't you give up on me  
Don't you give up on me  
Don't you give up on me  
I won't give up on you  
  
I'm talking to myself  
I'm trying to make sense  
Of everything that's going on  
But sometimes it's just too much  
  
I've been changing so much  
I've been living with ghosts  
I just want to start over  
I just want to be new but  
  
Don't you give up on me  
Don't you give up on me  
Don't you give up on me  
I won't give up on you  
  
Don't you give up on me  
Don't you give up on me  
Don't you give up on me  
I won't give up on you  
  
What if I'm crazy?  
There's no one here to help me  
They are building a wall  
I just want to get to the other side  
  
What if I'm crazy?  
There's no one here to help me  
They are building a wall  
I just want to get to the other side  
  
Don't you give up on me  
Don't you give up on me  
Don't you give up on me  
I won't give up on you  

## Generating variations on existing lyrics

Sometimes you have generated a good verse, but GPT-3 decides that repeating the same verse over and over is a good idea. We can use prompts to solve this issue and introduce variation in the lyrics.

To do this we have to give some examples of a verse, and an alternative wording in the same structure. For example:

```text
lyrics:

On the corner of Main Street
Just trying to keep it in line
You say you wanna move on and
You say I'm falling behind
Can you read my mind?
Can you read my mind?

variation on the above lyrics:

I never really gave up on
Breaking out of this two-star town
I got the green light, I got a little fight
I'm gonna turn this thing around
Can you read my mind?
Can you read my mind?
```

For this experiment I added seven such examples to the prompt in the format

```text
lyrics:

{example lyrics 1}

variation on the above lyrics:

{example variation 1}

---

lyrics:

{example lyrics 2 - 7}

variation on the above lyrics:

{example variation 2 - 7}

---

lyrics:

{lyrics you want to generate a variation on}

variation on the above lyrics:
```

If I take the first verse from the generated Franz Ferdinand song and put it in there it outputs the following variation.

lyrics:  
  
You'd better be dreaming of trees  
They are standing and growing  
If you believe in all you see  
While you're still half asleep  
  
variation on the above lyrics:  
  
You'd better be dreaming of me  
I am standing and waiting  
If you believe in what you feel  
While you're still half asleep  

Inserting this new variation gives a whole new spin to the song

artist: Franz Ferdinand  
bio: Franz Ferdinand are a Scottish rock band formed in 2002. The band's original lineup was composed of Alex Kapranos, Nick McCarthy, Bob Hardy, and Paul Thomson.
The band's music is often described as a mix of post-punk and indie rock, with influences ranging from new wave to disco. The band's persona is one of cool detachment, and their lyrics often deal with themes of love and loss.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Clouds on the Horizon]  
  
You'd better be dreaming of trees  
They are standing and growing  
If you believe in all you see  
While you're still half asleep  
  
You'd better be dreaming of me  
I am standing and waiting  
If you believe in what you feel  
While you're still half asleep  
  
Do you see the cloud on the horizon?  
Do you see the people waking?  
  
Fear of what you see  
If you're afraid of what they mean  
You can change them again  
You won't even notice when  
  
Glitter, glamour and gold  
They are all around you  
If you lie that you own it  
You will only ever own nothing  
  
Do you see the cloud on the horizon?  
Do you see the people waking?  
  
Fear of what you see  
If you're afraid of what they mean  
You can change them again  
You won't even notice when  
They're gone  

Without retraining the fine-tuned lyrics model we can steer a song in new directions by adding tags to the already created output. For the next example I thought the lyrics generated for the previously generated song "Chasing after dreams" could use a twist to keep the song interesting until the end. A bridge would be a good way to achieve this twist. To get the model to write a bridge I added tags for verse, chorus and pre-chorus and ended the prompt with a bridge tag. Amazingly it did add a bridge, even though the model was not trained to work with these tags! I think this is a great example of the flexibility of these models.

artist: Jack Johnson  
bio: Jack Johnson is a professional surfer turned musician. He is best known for his mellow acoustic music, which has been dubbed "surf-rock." Johnson is a laid-back guy who likes to keep things simple. He is known for his eco-friendly lifestyle and his support of various charities.  
description: The lyrics of this song are about dreaming and hope. The author encourages the listener not to be afraid of their dreams, even if they are afraid of what they may represent. They can be seen as a place of potential growth and change. The author also reassures the listener that their dreams are still alive and that they have the power to make them come true.  
mood: The mood is contemplative but hopeful  
  
###  
  
[Chasing After Dreams]  
  
# verse 1  
Find your place amongst the stone  
And let it be your home  
Come and rest your weary bones  
The sky is waiting for your call  
  
# verse 2  
Tiger lilies in the breeze  
Dance among the stars at night  
That's when all the children dream  
That they are something they are not  
  
# pre-chorus  
"Oh, oh, oh"  
Don't be afraid  
"Oh, oh, oh"  
Don't be afraid  
  
# chorus  
We're chasing after dreams  
But our dreams are chasing us  
We're chasing after dreams  
But our dreams are chasing us  
  
# verse 3  
And I'll be there to catch you  
As the music starts to play  
It is time to fire up those dreams  
The world is waiting for your call  
  
# verse 4  
In a city of stone and steel  
Love can be your home  
Let it flow to where you're sleeping  
And you don't have to go alone  
  
# pre-chorus  
"Oh, oh, oh"  
Don't be afraid  
"Oh, oh, oh"  
Don't be afraid  
  
# chorus  
We're chasing after dreams  
But our dreams are chasing us  
We're chasing after dreams  
But our dreams are chasing us  
  
# verse 5  
And I'll be there to catch you  
As the music starts to play  
Dreams are dancing through the night  
We've got time to dream our lives away  
  
# bridge  
Just take me to where it's all coming back  
To where we started, I'm still here  
Maybe in here  
It all makes sense  
Now I don't know where I've been  
When we were chasing after dreams

## Conclusion

Although it still takes some of tweaking to get the results you want, this fine-tuned version of GPT-3 is very useful for providing inspiration for lyrics. It often comes up with ideas that I would never have thought of on my own, and it's a great way to get the creative juices flowing. The process of generating new lyrics and trying different styles is a lot of fun, and I found myself trying many different variations. Prompt programming is very flexible so it is easy to try out new ideas.

However one should be careful not to plagiarize other lyrics or writings. for example the prompt with 5 examples used some lyrics that are taken from [an inspirational quote from Liam Payne](https://www.goodreads.com/quotes/893779-dreams-are-like-stars-you-may-never-touch-them-but).

```
Dreams are like stars
You may never touch them
But if you follow them
They will lead you to your destiny
```

I was also surprised at how useful GPT-3 is out of the box for preparing data. You can ask it to extract useful features from text, and use these features as data to finetune a new model.

I can definitely see tools like this being used by writers or musicians. Maybe not to generate entire songs with one click of a button, but more as a writing companion.
