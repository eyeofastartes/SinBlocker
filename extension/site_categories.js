const SITE_CATEGORIES = {
  "social": {
    "label": "Social",
    "color": "#d946ef",
    "sites": [
      "facebook.com", "instagram.com", "twitter.com", "x.com", "reddit.com",
      "tiktok.com", "pinterest.com", "snapchat.com", "linkedin.com",
      "whatsapp.com", "telegram.org", "signal.org", "tumblr.com", "quora.com",
      "discord.com", "threads.net", "blueskyweb.xyz", "mastodon.social",
      "socialcatfish.com", "spokeo.com", "beenverified.com", "truthfinder.com",
      "intelius.com", "peekyou.com", "whitepages.com", "peoplefinder.com",
      "radaris.com", "fastpeoplesearch.com", "myheritage.com", "ancestry.com",
      "23andme.com", "familysearch.org", "mylife.com", "usphonebook.com"
    ]
  },
  "gaming": {
    "label": "Gaming",
    "color": "#8b5cf6",
    "sites": [
      "steampowered.com", "twitch.tv", "epicgames.com", "gog.com", "itch.io",
      "roblox.com", "minecraft.net", "ea.com", "ubisoft.com", "nintendo.com",
      "playstation.com", "xbox.com", "battle.net", "riotgames.com",
      "store.steampowered.com", "humblebundle.com", "gamespot.com", "ign.com",
      "pcgamer.com", "kongregate.com", "miniclip.com", "poki.com",
      "newgrounds.com", "addictinggames.com", "armorgames.com", "y8.com",
      "nexon.com", "worldoftanks.com", "worldofwarships.com", "guildwars2.com",
      "maplestory.nexon.net", "perfectworld.com", "wargaming.net",
      "gaijin.net", "warframe.com", "destinythegame.com", "elderscrollsonline.com",
      "finalfantasyxiv.com", "runescape.com", "oldschool.runescape.com",
      "pathofexile.com", "wowhead.com", "mmo-champion.com", "nexon.net",
      "fandom.com", "gamepedia.com", "wikia.com", "gamerant.com", "kotaku.com",
      "polygon.com", "destructoid.com", "rockpapershotgun.com", "eurogamer.net",
      "videogameschronicle.com", "nintendolife.com", "pushsquare.com",
      "purexbox.com", "gematsu.com", "siliconera.com", "rpgfan.com",
      "curseforge.com", "g2a.com", "allkeyshop.com",
    ]
  },
  "news": {
    "label": "News",
    "color": "#ef4444",
    "sites": [
      "nytimes.com", "washingtonpost.com", "reuters.com",
      "apnews.com", "theguardian.com", "npr.org", "bloomberg.com", "forbes.com",
      "wired.com", "arstechnica.com", "techcrunch.com",
      "engadget.com", "cnet.com", "zdnet.com", "pcmag.com", "tomshardware.com",
      "foxnews.com", "newsmax.com", "breitbart.com", "theblaze.com",
      "dailywire.com", "oann.com", "theepochtimes.com", "justthenews.com",
      "wnd.com", "pjmedia.com", "washingtonexaminer.com", "washingtontimes.com",
      "nationalreview.com", "reason.com", "thefederalist.com",
      "americanthinker.com", "townhall.com", "zerohedge.com", "infowars.com",
      "gatewaypundit.com", "redstate.com", "hotair.com", "twitchy.com",
      "newsbusters.org", "thepostmillennial.com",
      "westernjournal.com", "ground.news",
      "googleblog.com", "blog.google",
      "theverge.com", "mashable.com", "gizmodo.com", "lifehacker.com",
      "buzzfeed.com", "vice.com", "slate.com", "vox.com", "theatlantic.com",
      "newyorker.com", "time.com", "usatoday.com", "latimes.com",
      "chicagotribune.com", "nypost.com", "dailymail.co.uk", "mirror.co.uk",
      "thesun.co.uk", "independent.co.uk", "telegraph.co.uk", "thetimes.co.uk",
      "crystalinks.com", "bibliotecapleyades.net", "ancient-origins.net",
      "history.com", "smithsonianmag.com", "nationalgeographic.com",
      "atlasobscura.com", "medium.com", "substack.com", "wordpress.com",
      "blogger.com"
    ]
  },
  "banking": {
    "label": "Banks & Payment",
    "color": "#0ea5e9",
    "sites": [
      "chase.com", "bankofamerica.com", "wellsfargo.com", "citibank.com",
      "usbank.com", "pnc.com", "capitalone.com", "td.com", "truist.com",
      "hsbc.com", "barclays.com", "americanexpress.com", "discover.com",
      "ally.com", "schwab.com", "fidelity.com", "vanguard.com", "etrade.com",
      "paypal.com", "stripe.com", "venmo.com", "cash.app", "zelle.com",
      "wise.com", "revolut.com", "monzo.com", "chime.com", "sofi.com",
      "coinbase.com", "binance.com", "kraken.com", "gemini.com",
      "blockfi.com", "robinhood.com", "webull.com", "m1.com", "acorns.com",
      "betterment.com", "wealthfront.com", "intuit.com", "mint.com",
      "plaid.com", "square.com", "shopify.com", "klarna.com", "afterpay.com",
      "affirm.com", "sezzle.com", "adyen.com", "checkout.com", "braintreepayments.com", "anz.com"
    ]
  },
  "shopping": {
    "label": "Shopping",
    "color": "#f59e0b",
    "sites": [
      "amazon.com", "ebay.com", "etsy.com", "walmart.com", "target.com",
      "bestbuy.com", "aliexpress.com", "costco.com", "homedepot.com",
      "lowes.com", "ikea.com", "wayfair.com", "overstock.com", "newegg.com",
      "bhphotovideo.com", "microcenter.com",
      "iherb.com", "vitacost.com", "swansonvitamins.com", "thrivemarket.com",
      "grove.co", "wholefoodsmarket.com", "tradersjoes.com", "kroger.com",
      "safeway.com", "albertsons.com", "publix.com", "wegmans.com",
      "arizonacustomknives.com", "bladehq.com", "knifecenter.com",
      "cabelas.com", "basspro.com", "realtree.com", "smkw.com",
      "buckknives.com", "benchmade.com", "spyderco.com", "gerbergear.com",
      "buymeacoffee.com", "ko-fi.com", "patreon.com", "subscribestar.com",
      "etsy.com", "gumroad.com", "storenvy.com"
    ]
  },
  "streaming": {
    "label": "Streaming & Media",
    "color": "#ec4899",
    "sites": [
      "youtube.com", "netflix.com", "spotify.com", "soundcloud.com", "bandcamp.com",
      "deezer.com", "tidal.com", "pandora.com", "audible.com", "hulu.com",
      "disneyplus.com", "max.com", "peacocktv.com", "paramountplus.com",
      "primevideo.com", "vimeo.com", "dailymotion.com", "imgur.com", "flickr.com",
      "unsplash.com", "pexels.com", "pixabay.com", "shutterstock.com",
      "musica-mundana.com", "music.apple.com", "amazon.com/music",
      "last.fm", "genius.com", "allmusic.com", "discogs.com", "mixcloud.com",
      "audiomack.com", "jamendo.com", "freeplaymusic.com", "incompetech.com",
      "musopen.org", "naxos.com", "prestomusic.com", "qobuz.com", "tunein.com",
      "twitch.tv", "crunchyroll.com", "funimation.com", "apple.com",
      "plex.tv", "tubitv.com", "crackle.com", "pluto.tv", "kanopy.com",
      "criterion.com", "mubi.com", "hoopladigital.com"
    ]
  },
  "productivity": {
    "label": "Productivity",
    "color": "#10b981",
    "sites": [
      "notion.so", "trello.com", "asana.com", "monday.com", "clickup.com",
      "todoist.com", "airtable.com", "evernote.com", "obsidian.md",
      "bear.app", "roamresearch.com", "coda.io", "miro.com", "mural.co",
      "figma.com", "canva.com", "adobe.com", "dribbble.com", "behance.net",
      "deviantart.com", "artstation.com", "invisionapp.com", "sketch.com",
      "zoom.us", "slack.com", "teams.microsoft.com", "meet.google.com",
      "webex.com", "discord.com", "calendly.com", "doodle.com",
      "clockify.me", "toggl.com", "rescuetime.com", "forestapp.cc",
      "focusmate.com", "pomofocus.io", "grammarly.com", "deepl.com",
      "languagetool.org", "zapier.com", "ifttt.com", "make.com",
      "icloud.com", "dropbox.com", "box.com", "onedrive.com", "drive.com",
      "notion.site", "linktr.ee", "carrd.co",
    ]
  },
  "corporate": {
    "label": "Corporate & Enterprise",
    "color": "#6366f1",
    "sites": [
      "google.com", "microsoft.com", "apple.com", "amazon.com", "meta.com",
      "alphabet.com", "oracle.com", "ibm.com", "salesforce.com", "sap.com",
      "adobe.com", "cisco.com", "intel.com", "nvidia.com", "amd.com",
      "dell.com", "hp.com", "lenovo.com", "samsung.com", "sony.com",
      "logitech.com", "zoom.us", "slack.com", "atlassian.com", "workday.com",
      "servicenow.com", "snowflake.com", "databricks.com", "hubspot.com",
      "twilio.com", "microsoftonline.com"
    ]
  },
  "mail": {
    "label": "Email",
    "color": "#f43f5e",
    "sites": [
      "gmail.com", "outlook.com", "yahoo.com", "proton.me", "protonmail.com",
      "zoho.com", "fastmail.com", "tutanota.com", "icloud.com", "aol.com",
      "gmx.com", "mail.com", "hushmail.com", "mailfence.com", "startmail.com",
      "hey.com", "superhuman.com", "onmail.com", "protonmail.ch", "tuta.com",
    ]
  },
  "learning": {
    "label": "Learning & Education",
    "color": "#84cc16",
    "sites": [
      "grokipedia.com", "khanacademy.org", "coursera.org", "edx.org",
      "udemy.com", "udacity.com", "skillshare.com", "brilliant.org",
      "duolingo.com", "memrise.com", "quizlet.com", "chegg.com",
      "bartleby.com", "study.com", "brainly.com", "wolframalpha.com",
      "desmos.com", "geogebra.org", "codecademy.com", "freecodecamp.org",
      "code.org", "pluralsight.com", "linkedin.com", "lynda.com",
      "datacamp.com", "kaggle.com", "openai.com", "anthropic.com",
      "ox.ac.uk", "cam.ac.uk", "ucl.ac.uk", "imperial.ac.uk",
      "ed.ac.uk", "manchester.ac.uk", "ac.uk", "edu.au", "edu.sg",
      "utoronto.ca", "ubc.ca", "mcgill.ca", "uwaterloo.ca", "open.ac.uk",
      "schoology.com", "canvaslms.com", "blackboard.com", "moodle.org",
      "edsurge.com", "cambridge.org", "pearson.com", "brainscape.com"
    ]
  },
  "sports": {
    "label": "Sports & Activities",
    "color": "#14b8a6",
    "sites": [
      "espn.com", "nfl.com", "nba.com", "mlb.com", "nhl.com", "mls.com",
      "uefa.com", "fifa.com", "f1.com", "nascar.com", "wwe.com", "ufc.com",
      "olympics.com", "bleacherreport.com", "barstoolsports.com",
      "deadspin.com", "sbnation.com", "theathletic.com", "cbsports.com",
      "yahoo.com", "bbc.com", "skysports.com", "talksport.com",
      "strava.com", "komoot.com", "alltrails.com", "mapmyrun.com",
      "runkeeper.com", "nike.com", "adidas.com", "underarmour.com",
      "lululemon.com", "decathlon.com", "rei.com", "garmin.com", "fitbit.com",
      "peloton.com", "zwift.com", "myfitnesspal.com", "loseit.com",
      "bodybuilding.com", "muscleandstrength.com", "crossfit.com",
      "yogawithadriene.com", "downdogapp.com", "dailyburn.com"
    ]
  },
  "localhost": {
    "label": "Localhost & Dev Environments",
    "color": "#94a3b8",
    "sites": [
      "localhost", "127.0.0.1", "0.0.0.0", "local.test", "localhost.localdomain",
      "lvh.me", "nip.io", "sslip.io", "localtest.me"
    ]
  },
  "development": {
    "label": "Developer & API Services",
    "color": "#3b82f6",
    "sites": [
      "github.com", "stackoverflow.com", "gitlab.com", "bitbucket.org",
      "dev.to", "hashnode.com", "medium.com", "towardsdatascience.com",
      "npmjs.com", "yarnpkg.com", "pypi.org", "packagist.org", "rubygems.org",
      "crates.io", "nuget.org", "docker.com", "kubernetes.io", "aws.amazon.com",
      "cloud.google.com", "azure.microsoft.com", "heroku.com", "netlify.com",
      "vercel.com", "cloudflare.com", "digitalocean.com", "linode.com",
      "render.com", "railway.app", "fly.io", "supabase.com",
      "firebase.google.com", "mongodb.com", "postgresql.org", "mysql.com",
      "redis.io", "elastic.co", "grafana.com", "prometheus.io", "datadoghq.com",
      "newrelic.com", "sentry.io", "jetbrains.com", "codesandbox.io",
      "codepen.io", "replit.com", "glitch.com", "codespaces.github.com",
      "hackerrank.com", "leetcode.com", "codewars.com", "exercism.org",
      "topcoder.com", "hackerearth.com", "openai.com", "huggingface.co",
      "groq.com", "together.xyz", "replicate.com", "stability.ai",
      "neon.tech", "planetscale.com", "turso.tech", "upstash.com",
      "clerk.com", "auth0.com", "kinde.com",
      "sanity.io", "contentful.com", "prismic.io", "algolia.com",
      "stripe.com", "twilio.com", "sendgrid.com", "mailgun.com", "resend.com",
      "plaid.com", "shippo.com", "stytch.com", "lucide.dev"
    ]
  },
  "ai_chat": {
    "label": "AI & Chat",
    "color": "#22d3ee",
    "sites": [
      "venice.ai", "chatgpt.com", "openai.com", "anthropic.com", "claude.ai",
      "google.com", "gemini.google.com", "bard.google.com", "gemini.com",
      "bing.com", "copilot.microsoft.com", "microsoft.com",
      "deepseek.com", "chat.deepseek.com", "grok.com", "x.ai", "deepai.org",
      "perplexity.ai", "poe.com", "you.com", "chatsonic.com", "writesonic.com",
      "jasper.ai", "copy.ai", "rytr.me", "wordtune.com", "quillbot.com",
      "grammarly.com", "synthesia.io", "runwayml.com", "playground.com",
      "stability.ai", "midjourney.com", "leonardo.ai", "ideogram.ai",
      "firefly.adobe.com", "adobe.com", "krea.ai", "nightcafe.studio",
      "deepdreamgenerator.com", "artbreeder.com", "dall-e.com", "dalle.com",
      "huggingface.co", "replicate.com", "civitai.com", "getimg.ai",
      "dreamstudio.ai", "photoroom.com", "remove.bg", "cutout.pro",
      "elevenlabs.io", "voice.ai", "play.ht", "murf.ai", "suno.com", "udio.com",
      "luma.ai", "pika.art", "sora.com", "veed.io", "invideo.io",
      "descript.com", "otter.ai", "assemblyai.com", "anthropic.com",
      "character.ai", "replika.com", "chai.ml", "janitorai.com", "candy.ai",
      "pygmalion.chat", "pygmalionai.chat", "sillytavern.app", "koboldai.com",
      "novelai.net", "tavernai.com", "agnai.chat", "risuai.xyz", "dreamjourneyai.com",
      "talkpal.ai", "mem.ai", "notion.so", "mindgrasp.ai", "scite.ai",
      "elicit.com", "consensus.app", "connectedpapers.com", "semanticscholar.org",
      "codeium.com", "tabnine.com", "cursor.com", "windsurf.com", "v0.dev",
      "bolt.new", "lovable.dev", "replit.com", "codesandbox.io", "stackblitz.com",
      "ollama.com", "lmstudio.ai", "mistral.ai", "cohere.com", "ai21.com",
      "meta.ai", "qwen.ai", "kimi.ai", "moonshot.ai", "z.ai", "gptzero.me"
    ]
  },
  "search": {
    "label": "Search Engines",
    "color": "#eab308",
    "sites": [
      "google.com", "bing.com", "duckduckgo.com", "brave.com",
      "searx.org", "searx.be", "searxng.org", "mojeek.com"
    ]
  },
  "bootleg": {
    "label": "Bootleg",
    "color": "#dc2626",
    "sites": [
      "bingebang.tv", "zoechip.bz", "reelix.ac", "flickbuff.cc", "flystream.net",
      "movienerds.site", "allflix.org", "cineapse.net", "zenox.lol", "pstream.cfd",
      "shiopa.com", "novahd.cc", "averotv.top", "cinejoy.pk", "zetmoon.live",
      "flaxfer.lol", "cinevaro.app", "cinehd.vc", "stellar.gdn", "filmex.to",
      "flixeo.tv", "nightflix.us", "vidplay.top", "hydrahd.info", "soapy.to",
      "rentry.co", "himovies.ac", "ridomovies.tv", "flixbaba.info",
      "streamingunity.dog", "movieplex.online", "vidflix.live", "theflixbay.com",
      "1shows.org", "nepu.io", "netprime.bz", "bcine.ru", "redflix.one",
      "2flix.lol", "solarmovie2.com", "yesmovies.ag", "myflixer.sc",
      "moviesjoy.bz", "cornclick.com", "flixer.gd", "myflixerz.org",
      "hdtoday.sc", "movish.to", "pressplayz.to", "seeflix.to",
      "boredflix.to", "noxx.gg", "azmovies.to", "wco.tv"
    ]
  }
}
