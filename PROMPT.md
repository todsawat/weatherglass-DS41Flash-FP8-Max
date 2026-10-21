# Weatherglass — detailed visual and feature brief

Build **Weatherglass**: an interactive 3D toy that runs in the browser as one self-contained HTML page. This brief describes in detail what it must look like, how it behaves and what the user can do. The implementation is up to you, but match the appearance and behaviour described here as closely as you can. Where a number is given, treat it as the target.

## 1. The idea

A miniature living landscape is sealed inside a brass-and-glass display case that stands on a walnut plinth, on a dark wooden table, in a dim photographic studio. The user plays the weather with their hands: grabbing clouds, squeezing rain out of them, shaking them into lightning, blowing wind, pouring fog, wiping the misted glass, dragging the sun round the case and turning the seasons.

It should feel like a quiet, tactile, premium museum object photographed with a macro lens. It is not a game: no score, no goals, no text in the scene. The page title is "Weatherglass".

## 2. The opening view and the camera

**First frame.** A three-quarter product shot.

- The camera is in front of the case, swung about 22° to the right and looking down at about 25°, through a narrow lens (about 34° vertical field of view), so perspective is gentle and the case looks like a small object seen from arm's length.
- The case fills most of the screen. Its top front edge runs across the upper part of the frame, rising slightly to the right. The right side pane is visible in perspective. The left front post stands near the left edge of the screen. The bottom of the frame cuts through the plinth.
- The sun is a small, very bright warm disc with a soft six-point flare and a short horizontal streak, hanging **outside** the case at the upper left of the frame.
- Three white cumulus clouds float inside the case above and in front of the mountains.
- It is a calm spring afternoon: the clock reads 15:14, the temperature 18°, the weather "sunny", the season "Spring". The cherry trees are in pale pink blossom and the grass is fresh green.
- The top and bottom of the frame are slightly out of focus, like a tilt-shift photograph. The image has a gentle dark vignette, very slightly warm highlights and a trace of fine film grain. Bright things (sun, lit windows, lightning) bloom softly.

**Reference colours as they appear on screen in this view:** studio backdrop `#28231e` (right) to `#423b33` (left, near the sun); glass edges `#518f7d`; brass `#ae9365` in the light and `#5b4428` in shade; walnut `#33241b`; sunlit grass `#8aa16f`, shaded grass `#31442b`; pines `#263e2b`; sunlit rock `#9a9791`, shaded rock `#434444`; lake `#397f86`; clouds `#dddbd8`; cherry blossom `#b4949a`; log walls `#6e6054`.

**Camera behaviour.**

- Dragging on empty space orbits the camera round the case; it can go from almost overhead to almost level with the table, and all the way round. Scrolling or pinching zooms from a close-up of part of the landscape to a wide shot with the case small in the frame. Right-drag also orbits; middle-drag pans a little.
- All camera movement is smooth and eased. The camera breathes with a barely visible vertical bob, and after half a minute without input it sways very slowly.
- Zooming in narrows the in-focus band and strengthens the blur above and below it, so close views look even more like a miniature. Looking from above weakens the blur.
- On a tall phone screen the lens widens slightly and the camera pulls back so the whole case always fits.
- A lightning strike shakes the camera briefly.

## 3. The case and its setting

Proportions: the inside of the case is **12 wide × 8 deep × 9.2 tall**. Use these units for everything below.

**Glass.**

- Five panes: four walls and a thick lid slab that overhangs the walls slightly.
- The glass is almost perfectly clear when viewed straight on and turns faintly bottle-green at grazing angles and near the frame.
- Its cut edges glow a bright teal-green: most visibly the bevelled rim of the lid all the way round, and the top edges of the walls. Inside the edge you can see faint lighter and darker bands that shift as the camera moves.
- The panes carry soft, tall, vertical reflections of studio softboxes (four round the room, one overhead), stronger at grazing angles, and a small sharp mirrored highlight of the sun or moon.
- Only where light catches them, you notice faint greasy smudges, hairline scratches, specks of dust and a few fingerprints with visible ridges. They must never fog the view.
- Seen from inside the case, the panes reflect the diorama's own sky and haze colours instead of the studio.

**Brass frame.**

- A slim round post at each corner (about 0.18 thick): a flared turned base, a long plain shaft, a collar and cap at the top, and a small ball finial that rises above the lid.
- A flat rail about 0.24 tall round the top of the walls, and a taller shoe rail about 0.45 tall round the bottom, each with a row of small dome rivets: nine along each long side and five along each short side.
- A small turned brass knob, about 0.3 tall, in the centre of the lid.
- The brass is warm gold, softly reflective, and visibly aged: darker, duller and browner low down and in recesses, with a few green-black patina freckles, but polished bright on the knob, the finials and the upward-facing surfaces where hands would touch it.

**Plinth.** Dark figured walnut under a soft clear coat, about 1.2 tall and about 0.4 wider than the case on every side, with rounded corners and a moulded profile: a rounded nosing at the top, a concave cove, a small bead, a flat frieze about 0.6 tall, an S-curved base moulding and a plain foot. The grain runs along each face, with wavy growth lines, lighter figure and fine pores. It is slightly worn and paler along the top edge and darker toward the foot.

**Plaque.** A small brushed-brass plate (about 2.3 wide × 0.3 tall) centred on the plinth's front frieze, held by two tiny screws, engraved **WEATHERGLASS** in bold, widely spaced serif capitals inside a thin double border, with a small diamond at each end. The engraving is dark and slightly recessed, with a faint light edge.

**Gauge.** On the front frieze to the right of the plaque, a round brass-bezelled dial about 0.5 across under a domed glass crystal that shows studio reflections.

- A cream face, slightly darker toward the rim.
- Round the outside, a humidity scale from 0 to 100 with fine tick marks, numerals every 20 in dark navy, and a soft green band over 40–60.
- Inside it, a temperature scale from −20 to 40 °C with numerals every 10 in dark red, and a soft blue band below zero.
- Lettering: "HUMIDITY %" in small spaced capitals above the centre, "°C" below it, and "Weatherglass & Co." in tiny italics at the bottom.
- Both scales sweep 270°, from lower-left through the top to lower-right.
- A long blue-steel needle shows humidity; a shorter red needle shows the temperature at lake level. They follow the real weather with a slight overshoot and quiver, and a tap on the gauge makes them jump and resettle.

**Table.** Wide, dark, matt wooden planks with staggered joints, lit in a soft pool round the case and fading into darkness beyond it. There is a deep contact shadow where the plinth stands. The case casts a real shadow on the table that swings round as the sun moves.

**Backdrop.** A dim, warm, dark-brown room with a soft lighter halo behind the case as seen from the camera, darker toward the ceiling, with a faint cloth-like mottling. No sky, no horizon. At golden hour the halo turns amber; at night the room goes almost black (`#121010`) with a cool tint; in a storm it darkens; lightning brightens it for an instant.

**How the studio follows the weather.** The softbox reflections on glass and brass dim at night and in storms. The mirrored sun highlight is warm and strong by day, absent at night; the moon gives a small cool highlight. Lightning flashes in the glass and brass.

## 4. The landscape

The land is a solid block that fills the floor of the case and is **cut off flush by the glass on all four sides**, so every side shows a cross-section of soil, and the lake is sliced by the front glass so you look into the water from the side.

Floor plan: x runs from −6 (left) to +6 (right); z from −4 (back wall) to +4 (front glass). Heights: the lake surface is at 0.1; the block's underside is at −1.8, so about two units of soil show along the front; the lid is at 7.4.

### 4.1 Mountains, waterfall, river, lake

- **Mountains** along the back wall: five craggy peaks. The tallest is back-left (around x −3.4, about 4 high, reaching toward the clouds), then back-centre (x −0.5, about 3), centre-right (x 2, about 3.3), back-right (x 4.5, about 2.5) and a low foothill on the far left (x −5.4, about 1.5). Between and in front of them the ground rises toward the back wall like a ramp.
- **Mountain rock** is grey with a slightly warm cast, in clear horizontal strata with ledges, darker cracks, a few rusty beds, vertical rain-streak stains, pale lichen patches on upward faces and dark moss low down. Crevices are shadowed. Grass covers the gentler slopes up to about 2.5 high and becomes thinner and duller with height; the steep faces and summits are bare.
- **Waterfall.** Between the first two peaks, at about x −1.5, a rocky shelf about 2.2 high ends in a cliff facing the viewer. A small spring rises on the shelf, runs a short way and drops about one unit as a narrow waterfall about 0.25 wide. At the lip the water is a smooth, dark, glassy tongue; below that it breaks into bright white foam strands that slide downward. It flutters slightly in the wind. At its foot there is a round pool of churning foam with rings spreading outward, fine spray droplets and a slow drifting mist, ringed by wet, mossy boulders.
- **River.** From the pool the river runs diagonally toward the front right, stepping down in small terraces, widening from about 0.2 to 0.5. The water is clear teal over a pebbly bed, with moving ripple patterns that travel downstream, white foam streaks on the steeper steps, thin lines of bubbles, and dark muddy banks edged with pebbles and moss. A row of four to six flat mossy stepping stones crosses it about 40% of the way down. It enters the lake at about (2, 2) and blends into it without a seam.
- **Lake.** A teal lake in the front-right quarter, roughly an oval 4.7 wide × 3.5 deep centred at (2.75, 2.65), with a slightly irregular shoreline. A pale sandy beach with ripple marks and scattered pebbles surrounds it. It is clear in the shallows, where you can see the bed and bright moving caustic patterns, and deepens to opaque blue-green in the middle (about one unit deep). The surface carries small wind ripples, a thin line of foam that laps at the shore, a sharp sparkling sun reflection, and a soft mirror image of the mountains, trees and clouds.
- **The lake in cross-section.** The front glass cuts through the lake, so through the glass you see the water body from the side: a bright, slightly wavy surface line with a darker band just beneath it; clear teal water darkening with depth; slanting shafts of light that shift slowly; tiny drifting specks; the sandy bed; and the fish.

### 4.2 Soil cross-section

All four cut faces of the block show layered ground. From the top down, with wavy, uneven boundaries:

1. A thin green **turf edge**.
2. **Dark humus**, almost black-brown, a few millimetres to a quarter-unit thick, with fine pale roots hanging down from it (many thin ones and fewer thick ones).
3. **Brown loam**, with rusty mottles, small dark burrow holes and occasional embedded stones.
4. A thin band of **orange-tan clay** with fine horizontal lines.
5. A layer of **grey gravel and cobbles** in dark grit.
6. **Bedrock** at the bottom: bedded sandstone and grey rock with visible joints.

Under the mountains the bedrock rises almost to the surface and its beds tilt steeply. Under the lake the upper layers are replaced by pale sand and grey clay. Everything darkens toward the bottom of the block. After rain a darker, wetter band soaks down from the top edge. In winter a white snow cap sits on the top edge and gets thicker as snow builds up.

### 4.3 Meadow, ground, rocks

- **Meadow.** Gently rolling grassland at about 0.5–0.7 high, with a small knoll front-left for the cabin and a slight rise toward the left wall.
- **Ground surface** under the grass: green turf with drier, yellower patches; bare brown earth on the footpaths, round the cabin and in rings under the trees; dark mud along the river; pale sand round the lake.
- **Footpaths.** Three thin worn earth paths, paler in the middle: from the cabin door to the lake shore where the jetty starts (the widest, about 0.2); from the cabin to the stepping stones; and a short stub on the far bank.
- **Boulders.** Grey, faceted, slightly chiselled-looking rocks, each a different shape, partly sunk in the ground, with cracks, lichen and moss on their damp sides. Six large ones at about (−4.7, 2.75), (−1.35, 3.05), (4.95, 0.35), (0.95, −0.6), (−4.3, −0.15) and (3.6, −0.1), each with a few pebbles beside it. Many smaller stones along the lake shore, the river banks, the foot of the cliff and the mountain slopes. Between 100 and 200 rocks in all.

### 4.4 How the ground changes

- **Wet.** Rain darkens the ground and makes it glossy. Once it is thoroughly wet, mirror-like puddles appear in the hollows and reflect the sky; raindrops make rings in them. Rocks and logs go dark and shiny. Everything dries slowly afterwards, faster in sun and wind.
- **Snow.** Snow settles first on flat ground and builds up to an even white cover with a soft, broken edge on slopes; steep rock stays bare. The snow surface is very slightly raised, softly bumpy, and sparkles with tiny glints in sunlight. It melts into wetness when it warms up.
- **Frost.** On cold clear nights a pale frost whitens the ground and retreats from sunlit slopes in the morning.

## 5. Cabin, jetty, boat

**Log cabin** at (−2.95, 1.35), turned about 30° so its front faces the viewer and slightly toward the lake. It is tiny: about 0.7 long, 0.5 deep and 0.6 to the ridge.

- Walls of six courses of round honey-brown logs (`#8a6440`, with lighter and darker logs mixed), overlapping at the corners, with pale chinking between them. The gable ends above the logs are vertical boards.
- A fieldstone footing in mixed greys and tans.
- A 40° gable roof of grey-brown cedar shingles in visible stepped rows, with moss on the shaded side.
- A tall fieldstone chimney on the left end, outside the wall, rising a little above the ridge, sooty at the top.
- A dark red plank door (`#7a2c22`) with black iron hinges and a stone step.
- Four small four-pane windows with cream trim (`#e4dcc6`): one beside the door with dark green shutters (`#3c5e48`) and a flower box of tiny red, pink, white and orange flowers; one on the right end with shutters; one on the back; a small one on the left end.
- A narrow porch along the front with two posts, a stack of split firewood beside the door, and a small iron lantern on the wall above it.
- In the yard: a chopping block with an axe stuck in it and a few split logs, a rain barrel with iron hoops at the front-right corner, a crooked grey rail fence of six posts curving round the chimney side, and a stepping stone.

**Cabin behaviour.**

- A thin thread of pale smoke rises from the chimney, bends with the wind and gathers faintly under the glass lid. When it is cold, dark or stormy the fire is stoked: the smoke is thicker, darker and rises faster. Rain beats it down.
- At dusk the windows begin to glow warm orange (`#d27e4c` on screen) with a gentle flicker, showing curtains at the sides and a pot plant in the front window; the lantern lights; a small pool of warm light falls on the porch. In the small hours the glow dims to about a third. The windows also light under a daytime storm.
- In rain the exposed wood darkens and shines while the porch under the eave stays dry. In winter snow lies on the roof as a thick, lumpy white blanket that buries the shingle rows, and on the fence tops, barrel and chopping block.

**Jetty.** A short jetty of weathered silver-grey planks, about 0.85 long and 0.17 wide, on four pairs of round piles with cross-braces, running from the shore at about (0, 2.4) straight out toward the middle of the lake. Its last two piles stand up as mooring posts, and a coil of rope lies on the deck. A dark green algae band on the piles marks the waterline and moves with the lake level.

**Boat.** A small rowing boat about 0.34 long, dark green above the waterline (`#3d6b5e`) and red-brown below, with a pale wooden interior, three seats and two oars laid inside. It is tied to a mooring post by a sagging rope. It bobs, rocks and swings a little with the wind, more in a storm; a nearby splash makes it rock; when the lake freezes it sits still, locked in the ice.

## 6. Plants

**Trees.** Every tree is a real 3D tree with a trunk, branches and a rounded leafy crown that shades from light on the sunny side to dark inside. They sway in the wind (the whole tree leans and rocks, branches shiver, leaves flutter) and cast shadows.

- **Pines** (16 to 30 depending on device power): dark green, conical, built of stacked tiers of drooping fronds; about half are slender spruce shapes and half broader; a few are bluish. They stand on the back slopes and mountain shoulders, in clumps, shorter higher up, about 0.5–1.3 tall.
- **Oaks:** short trunks and broad round crowns, about 0.8–1.1 tall. One large oak (1.3 tall) stands left of the cabin at about (−4, 0.25).
- **Birches:** tall slender white trunks with dark marks, small drooping twigs, narrow crowns, about 0.85–1.2 tall. One prominent birch at the far left, about (−4.95, 1.5).
- Oaks and birches (11 to 20 in all) stand in loose groves at the far left front, left of centre, the right edge, the front-left shore and right of the river.
- **Cherry trees:** two small spreading trees with dark reddish bark, one front-left of the cabin at about (−3.75, 2.4) and one right of centre at about (3.3, 0.35).
- **Bushes** (14 to 32): low rounded shrubs, some evergreen, round the edges of tree crowns, beside big rocks and near the banks.
- Keep the view across the lake open: no trees in the front-right quarter, none on the paths or the cabin's yard.

**Grass.** Twenty thousand to over a hundred thousand individual thin blades, about 0.05–0.15 tall, growing in tufts. It is thin or absent under trees, on paths and on bare soil; taller and lusher near water; shorter and drier uphill. Blades vary in green, with some yellow-green ones and a few straw ones. Wind crosses the meadow as visible travelling waves, the bent crests catching a pale sheen. The grass receives the shadows of clouds and trees.

**Wildflowers.** Thousands of tiny flowers in drifts of one kind, each kind with its own time of year:

| Flower | Look | In bloom |
|---|---|---|
| Daisy | white petals with pink tips, yellow centre | late winter to late summer |
| Buttercup | glossy yellow cup | late winter to early summer |
| Violet | small purple, low | late winter to late spring |
| Poppy | large red, dark centre | mid-spring to late summer |
| Cornflower | blue, ragged petals | late spring to early autumn |
| Aster | lilac, thin petals, yellow centre | early summer to late autumn |

They turn their heads toward the sun during the day, nod and close their petals at night, open a little fuller after rain, sway with the grass and disappear under snow.

**Reeds.** Clumps of tall thin reeds (about 0.15–0.3) round the lake and along the lower river, with a few brown-headed cattails. Each bed sways together. They bleach to straw in autumn and droop under snow.

**Lily pads.** Up to forty small notched green pads in a few clusters in the lake's shallows, about a fifth of them with a white, pink-tipped flower. They ride and tilt on the ripples. They appear in spring, flower in summer, brown in autumn and are gone in winter.

## 7. Animals

- **Birds.** Five to nine small songbirds, slate-grey or warm brown with pale bellies. They fly as a loose flock under the clouds, flapping and gliding, banking in turns and avoiding the glass. Every twenty seconds or so they come down together onto perches near one spot (tree tops, the cabin ridge, the chimney, the fence posts, the jetty posts) where they hop, turn, look about and peck for ten to twenty seconds, then take off one after another. In rain, storms or heavy snow they go to sheltered perches (inside trees, under the porch eave) and stay. At night they roost. In autumn fewer are active and in winter most sit still. A tap on the glass, a click on the scene or a lightning strike flushes them into the air.
- **Butterflies** (5 to 11): white with dark wingtips, yellow, orange with an eye-spot, and blue. They flutter erratically between flower patches and settle with slowly fanning wings. Only on warm, calm, sunny spring and summer days.
- **Dragonflies** (2 to 4): blue or green, with glassy wings. They hover over the lake's shallows and dart to a new spot every few seconds. Summer, when the lake is open.
- **Fireflies** (80 to 220): yellow-green points that drift low over the meadow and the lake margin and blink slowly, each on its own rhythm. Warm, calm summer nights, a few in late spring. After a lightning flash they go dark for a few seconds.
- **Fish** (6 to 10): small silver fish with dark backs, and every third one orange with pale patches. They school slowly between the front glass and the middle of the lake, tails beating. Now and then one rises and dimples the surface. They bolt from splashes, and are slower at night and under ice.
- **Dust motes:** on dry sunny days, tiny specks glitter in the air when you look toward the sun.

## 8. Clouds

Clouds are soft, fully three-dimensional volumes, not flat pictures. Each is built from eight to thirteen overlapping rounded lobes: a fat core, two side lobes, two crowns and two base lobes.

**Look.**

- A flat, level base and billowing cauliflower tops with crisp, lumpy edges and wispier undersides. The surface boils very slowly.
- Bright white where the sun hits, soft grey in their own shadow, with a glowing "silver lining" when the sun is behind them.
- Sizes range from a small puff about 0.5 across to a giant filling a third of the case.
- They float in the upper part of the case, about 70–90% of the way up, bob gently, and drift at about half the wind's speed. Bigger clouds are more sluggish.
- They never pass through the glass. Their lobes squash softly against the walls and lid, and they slide up over the mountain tops.
- They cast soft-edged shadows that move across the land, darker under grey clouds.
- Hovering the pointer over a cloud brightens its outer shell.

**States.**

- **Dry:** small, pure white, crisp flat base.
- **Wet:** as a cloud holds more water it turns light grey, then slate, and looks denser.
- **Raining or squeezed:** it compresses (shorter and wider), darkens further, trembles finely, and its base becomes ragged and lower.
- **Storm:** very dark slate with a near-black base. A tall tower grows up through it to the lid, and a flat anvil spreads in a ring just under the glass, streaming slightly downwind. It sits a little lower than other clouds.
- **Charged:** small blue-white flashes flicker inside it, at different spots.
- **Golden hour:** peach-lit with lavender shadow sides. **Night:** dim blue-grey (`#889eb9` on screen), faintly moonlit.
- A cloud that runs out of water shrinks and fades away over a second or two. A new cloud fades in from small.
- There are never more than ten clouds; the oldest untouched one dissolves to make room.

## 9. Light and time of day

The sun and the moon are real glowing objects that circle the **outside** of the case, a little beyond the glass, rising on one side and setting on the other. All shadows (mountains, trees, cabin, the brass frame, the case on the table) follow them.

- The clock runs 00:00–24:00. Sunrise is always at 06:00 and sunset at 18:00. The season changes how high the sun climbs: highest in summer (about 63° at noon), lowest in winter (about 32°).
- **Sun.** A small, intensely bright disc with a soft glow, faint streamers and a thin six-point flare with a short horizontal streak. High in the sky it is white-gold. As it sinks it grows slightly, turns orange and then deep red, and flattens a little at the horizon. It dims behind clouds and is hidden behind mountains. It brightens and swells a little when the pointer is over it.
- **Moon.** Roughly opposite the sun: a pale disc with recognisable dark patches and a few craters, softly shaded on one side, with a cool blue halo and, in humid air, a faint coloured ring. A pale moon can be visible by day.
- **Midday:** neutral, bright, warm-white light (`#fff8ef`), crisp shadows that are sharp where objects touch the ground and soft further away, a cool blue fill in the shade.
- **Late afternoon and golden hour** (roughly 16:20–18:00): the light turns gold then orange (`#ffd7a6` to `#ffaf7c`), shadows grow long, foliage glows when lit from behind, the air inside the case turns faintly amber and the backdrop halo warms.
- **Dusk** (18:00–19:30): the direct light fades; everything is lit by a soft blue-violet ambience.
- **Night:** dark, with soft blue moonlight (`#adc5ff`) and moon shadows. Rock looks blue-grey (`#353b4b`), grass dark green (`#3c513b`), the lake nearly black-teal (`#0c202b`). The picture is exposed brighter than reality so the scene stays readable.
- **Stars:** on clear nights, 300 to 600 small twinkling points fill the upper part of the **inside** of the case, under the lid, in blue-white to warm tints, the brightest with tiny cross-shaped glints. They fade behind clouds, storms and fog. Every 15–40 seconds a short shooting star crosses under the lid.
- **Air:** the air inside the case is very slightly hazy, more so low down and far from the camera, so distant mountains are softer and bluer. When the sun is low, visible shafts of light and shadow slant through it. Haze thickens with humidity, rain, storm and fog.
- **Overcast:** as clouds cover more of the sky the sunlight weakens and cools, shadows soften and the ambience turns grey.

## 10. Seasons

The season is continuous: any point between the four is valid, and everything blends smoothly.

| | Spring | Summer | Autumn | Winter |
|---|---|---|---|---|
| Typical midday temperature at the lake | about 16° | about 28° | about 14° | about −3° |
| Grass | fresh bright green | deeper green, drier patches | tawny yellow-green | straw, thinner and shorter |
| Broadleaf trees | light yellow-green new leaves | full deep green | birches gold, cherries crimson, oaks russet, some still green | bare twigs; a few oaks keep brown leaves |
| Cherry trees | clouds of pale pink blossom in early spring | green | crimson | bare |
| Pines | dark green with pale new tips | dark green | dark green | dark green, snow on the branches |
| Flowers | violets, buttercups, daisies | poppies, cornflowers, daisies | asters | none |
| In the air | drifting petals | butterflies, dragonflies, fireflies at night | leaves falling one by one | snow |
| Wind | light | lightest | breeziest | brisk |

- Nights are about 9° colder than afternoons. Clouds reduce that swing; a storm cools the air by a few degrees.
- It gets colder with height, by about 5° for every unit, so the summits are about 15–20° colder than the lake. This is why it can snow on the peaks while it rains in the valley, and why the mountains keep snow after the meadow thaws.
- In autumn leaves leave the trees one at a time until only twigs remain; fallen leaves (reds, oranges and golds such as `#c8461a`, `#e07b1f`, `#e9a92b`, `#b5301c`, `#f0c24a`) tumble on the wind, lie on the ground for a while and float on the lake.
- Turning the dial glides smoothly from one season to the next, taking a second or two per season.

## 11. Weather

**Rain.**

- Rain falls only under a raining cloud, in a column the width of that cloud. When rain starts, the front of the column visibly descends from the cloud base to the ground; when it stops, the last drops fall away.
- Drops are thin, bright, slightly slanted streaks that lean with the wind and trail behind a moving cloud. They glow when lit from behind by the sun.
- Heavy rain adds soft grey vertical shafts under the cloud.
- Where it lands: tiny crown-shaped splashes hop on the ground and on rocks; rings spread on the lake and river; puddles ripple.
- Consequences: the ground darkens and turns glossy, then puddles form; the river and waterfall run fuller, faster and whiter; the lake rises visibly (by up to about a quarter-unit, creeping up the beach and the jetty piles) and turns slightly murky; the glass near the rain runs with drops.

**Thunderstorm.**

- The whole scene darkens and cools, the ambience turns grey-blue (storm cloud `#52585e`, grass `#3f472c`, lake `#2f4b53`, backdrop `#100d0b`), the wind rises and gusts, trees thrash and grass flattens in waves.
- **Lightning:** first a faint flickering thread races from the cloud base to the ground in under a tenth of a second. Then a jagged, brilliant blue-white bolt with two to four downward forks flashes along it, and flickers two or three more times within half a second, each weaker. Each flash lights the whole scene, the fog, the glass and the room for an instant. A violet afterglow lingers for about a second.
- It strikes the tallest tree under the cloud, or failing that the highest ground, or the lake.
- At the strike point: a white burst, a spray of white-hot sparks cooling to orange, and a small scorch patch of glowing embers that fades over a second or two. On the lake: a big splash and blue-white spray.
- The struck tree and its neighbours shake; birds scatter; the camera jolts; the cloud itself lights up inside.
- Thunder follows after a short delay that is longer when the strike is farther from the camera.
- Under a very heavy storm in warm weather, white hailstones fall fast, bounce twice and melt.

**Snow.**

- When the air under a cloud is below freezing, it drops slow, tumbling, fluttering white flakes instead of streaks. If the air is cold aloft and mild below, flakes turn to rain part-way down.
- Snow lies first on flat ground, then builds to a smooth white cover that sparkles; on conifers it sits in clumps on the upper sides of the branches; bare twigs carry thin lines of it; rocks get white caps.
- **Freezing.** After a while below zero the lake freezes from its shallow edges inward. The ice is pale blue-white (`#d5d7d9` on screen) with dark cracks, trapped white bubbles and wind-swept snow drifts. From the side, the ice shows as a pale band on top of dark water. The river ices over from its banks. In deep cold the waterfall becomes a fluted, blue-white ice curtain with ragged tips, icicles grow along the cliff lip, and the foam pool becomes a snowy mound.
- Thawing reverses all of it; melting snow swells the river.

**Fog.**

- A soft white layer up to about 1.5 thick that hugs the ground. It has a rolling, uneven top, is denser low down and wispy at the edges.
- It flows downhill, pools in the valley and over the lake, levels out like a liquid, drifts with the wind and piles up against the glass.
- It is lit from within: glowing gold toward a low sun, with the shadows of trees and mountains falling through it as soft shafts, and it flashes blue-white from inside during lightning.
- It forms by itself on humid, cool, calm dawns (most in spring and autumn), as thin steam over the lake after rain on a warm day or on a very cold morning, as drifting banks on the mountain flanks in very humid air, and as low mist after a storm. Sun, dry air, warmth and wind burn it off.

**Rare sights.**

- **Rainbow:** when rain is falling in sunlight and the sun is fairly low, a real rainbow fades in over a few seconds, in the correct place opposite the sun and only where the rain is. Red is on the outside. A fainter second bow with reversed colours sits outside it, with a slightly darker band between them.
- **Aurora:** on clear, cold nights from late autumn through winter, three translucent green curtains with violet tops ripple slowly just under the lid.

## 12. The glass in weather

- **Mist.** In humid, foggy, rainy or cold weather the inside of the panes mists over, starting at the edges and the top of each pane and spreading inward, with a soft irregular boundary. It glows softly when lit from behind. Sunlit panes clear first.
- **Beads and runs.** As mist thickens, tiny beads form. Now and then a single drop gathers, hangs, then runs down in fits and starts, wobbling slightly and leaving a clear streak. Each drop is a tiny lens with a bright rim.
- **Rain on glass.** When a rain column is near a wall, drops streak down that pane.
- **Frost.** Below freezing the mist turns into fern-like frost patterns that sparkle.
- **Wiping.** A wiped patch is clear, with a soft edge and a slight ridge of pushed-aside water. It slowly mists back over a minute or so.
- **Tapping.** A tap sends two faint iridescent rings rippling out from the touch point and makes the whole pane shiver for a moment.

## 13. What the user can do

**Hand tool** (default; arrow cursor that becomes a grabbing hand over things you can hold):

- **Grab a cloud** and drag it. It follows like soft jelly on a firm spring, its lobes lagging behind and wobbling. It stays at its own height.
- **Hold it still** for a fifth of a second and it starts being **squeezed**: over about two seconds it compresses, darkens, trembles and rains harder and harder. Moving again releases the squeeze. The wetter the cloud, the heavier the rain; a squeezed-out cloud shrinks and finally evaporates.
- **Scroll the wheel** over a cloud to squeeze it without holding it.
- **Shake it** hard from side to side: after about a second it flickers inside and crackles, then throws a lightning bolt.
- **Let go while moving** to fling it. It glides, bounces softly off the glass with a wobble, and settles back into the wind.
- **Push or fling one cloud into another** to merge them into one bigger, wetter cloud that reshapes itself with a big wobble. If the result is large and very wet it becomes a **thunderstorm**: it grows its tower and anvil, rains by itself and strikes every ten to fifteen seconds until it rains itself out.
- **Drag the sun or the moon** round the case to change the time of day. It follows with a little spring; a flick keeps it moving for a moment.
- **Grab a tree** and pull: it bends toward the pointer, and whips back and wobbles when released. A quick click flicks it. Shaken trees shed leaves in autumn, petals in blossom time, or a puff of snow in winter; hovering makes them shiver.
- **Click the lake:** a crown-shaped splash with a little jet and mist, rings spreading across the surface, and the fish scatter. Drag across it for a wake; hold still for steady rings. Click the frozen lake and a star of cracks appears in the ice with a glassy "tink". Click the river for a splash that drifts downstream.
- **Tap the glass** to make it ring, with a different pitch for each pane. The birds take off.

**Wind tool** (crosshair): sweep across the land. Faster sweeps blow harder. Faint white wisps trace each stroke for about a second. Grass flattens in a wave, trees bend, clouds and smoke and fog drift, fallen leaves fly, snow dust or pollen rises, the boat swings, and butterflies scatter.

**Cloud tool** (crosshair): press anywhere in the sky to condense a new small cloud with a soft pop. Keep holding and it grows and gathers water, faster in humid air. Drag while holding to paint its shape lobe by lobe. Pressing on an existing cloud feeds it instead.

**Fog tool** (crosshair): click to drop a puff of mist, drag to paint a trail, hold still to pour a growing mound. Fresh fog billows outward with small rolling puffs, then drains downhill and settles.

**Wipe tool** (a round ring cursor): rub the inside of the glass to clear the mist. If the near pane is already clear you wipe the far pane through it.

**Tap the brass gauge** to make its needles jump.

**Keyboard:** `1`–`5` (or `H`, `W`, `C`, `F`, `G`) choose the tools; `U` hides and shows the interface.

## 14. How everything is connected

No effect is canned; each of these must really drive the others.

- **Temperature** comes from the season, the time of day, altitude, cloud cover and storms. It decides rain or snow at each height, freezing and thawing of lake, river and waterfall, frost, whether insects fly and whether crickets and frogs sing.
- **Clouds** hold water. Squeezing or storms turn it into rain; rain drains the cloud. Humid air slowly refills clouds; dry, warm, sunny air evaporates them.
- **Rain** wets the ground, makes puddles, raises the lake, swells and whitens the river and waterfall, muddies the water, wets the glass, raises humidity, and makes rings on the water.
- **Humidity** rises with wet ground, fog and storms. It mists the glass, feeds fog, puts a ring round the moon and moves the gauge's needle.
- **Cloud cover and storms** dim and cool the light, soften shadows, light the cabin's windows, stoke its fire, strengthen the wind and silence the birds.
- **Wind** bends plants, moves clouds, smoke, fog, rain, snow, leaves and the boat, ruffles the lake, dries the ground.
- **Sun** melts snow and frost, dries the ground, burns off fog and clears the glass.
- **Animals** follow all of it, as described in section 7.

## 15. Interface

Minimal: small frosted-glass panels at the edges, icons without text labels, nothing over the centre of the scene. Interface clicks never affect the scene behind.

**Style.**

- Text `#f4efe6`; secondary text the same at 70%; accent "brass" `#ffd98a`.
- Panels: `rgba(21,19,17,0.56)` with a 16px background blur, a 1px border `rgba(255,246,228,0.13)`, 20px rounded corners, a faint light line along the top inside edge and a soft dark drop shadow.
- Interface text in the system sans-serif, 12px, medium weight. The title and all numerals in an old-style serif (Iowan Old Style, Palatino, Georgia).
- Icons are thin line drawings (1.6px strokes, rounded ends) in the text colour.
- Movements are short and springy with a slight overshoot. Margins from the screen edges are 18px.
- **Top-left: title.** The word "Weatherglass" in the serif, 17px, widely letter-spaced, 80% opacity, with a soft shadow and no box.
- **Top-right: action pill.** A fully rounded panel with three round 34px buttons: **sound** (a speaker with waves, brass-coloured when on; a speaker with an × when off), **fullscreen** (four corner brackets), **hide controls** (an eye with a slash). Buttons lift a pixel on hover and shrink slightly when pressed; a click sends a brief brass ring pulsing out from the button. Hovering shows a small label beneath: "Sound on / off", "Fullscreen", "Hide controls (U)". With the controls hidden, only a faint round eye button remains in the top-right corner.
- **Bottom-centre: toolbar.** One panel holding five 46px icon buttons in a row: an open hand, two curling gust lines, a cloud with a small plus, three wavy lines, and a square pane with a diagonal wiped streak and droplets.
- A soft brass-tinted rounded square with a faint glow slides behind the active tool, with a little squash as it moves. The active icon turns brass with a faint glow and pops slightly.
- On hover, after a short delay, a small dark tooltip appears above the button with the tool's name in brass serif, a key cap, and one line (see table). On touch screens there are no tooltips; the first tap on each tool shows its line as a hint instead.
- **Bottom-left: time panel** (about 184px wide, 80px tall). A small round play button and the clock as `15:14` in 21px serif. Under them, a thin curve tracing the sun's height over the 24 hours: low at the left (midnight), crossing a faint horizon line at 06:00, peaking at noon in the middle, crossing again at 18:00. Above the horizon the curve is a gold line with a soft warm fill beneath it; below the horizon it is a dashed pale-blue line. Three small ticks mark 06:00, 12:00 and 18:00. A small glowing sun with rays sits on the curve at the current time. As it crosses the horizon it cross-fades into a pale crescent moon. Click anywhere on the curve to glide to that time; drag along it to scrub, wrapping past midnight; scroll to nudge. The play button runs time forward so that a whole day passes in five minutes; while playing it shows a pause symbol in brass with a glow.
- **Bottom-right: climate panel.** The temperature at lake level as `18°` in 17px serif (a proper minus sign for negatives, no unit letter). Under it, one short lower-case weather phrase. The **season dial**, 92px across: a shallow dark dish with a soft coloured ring just inside its edge (pink at the top for spring, green at the right for summer, orange at the bottom for autumn, ice-blue at the left for winter, blending between), a few faint tick marks, and four tiny symbols inside the ring: a pink blossom at the top, a gold sun at the right, an orange maple leaf at the bottom, a pale snowflake at the left. The symbol nearest the current season is brighter and larger. A small round brass knob sits on the ring at the current season. The centre shows the season's name in serif, over a faint glow in the colour of the current foliage. Drag round the ring to turn the season continuously (a faint tick as each season passes); click a symbol to glide to it with a small chime; click the centre for the next season; scroll to nudge.
- **Hints.** Short pill-shaped messages that rise softly just above the toolbar and fade after a few seconds; at most three at once; a click dismisses one. Used for: "Drag the sun to change the time of day" and "Drag the moon to turn the night" (the first time the pointer passes over each), and "Wiped glass slowly mists back over" (after the first wipe).
- **Onboarding.** A few seconds after loading, a slightly larger pill appears above the toolbar with a round brass-tinted icon, one line in serif, six small progress dots and two small round buttons (next tip, dismiss). Each tip completes only when the user actually does it: the icon turns into a tick, a soft chime plays, and the next tip follows. Tips: 1 "Grab a cloud and drag it across the sky"; 2 "Hold still on a cloud to squeeze out rain"; 3 "Shake a cloud hard to build a storm"; 4 "Pick the Wind tool and sweep across the meadow" — a softly pulsing brass ring highlights the Wind button; once it is selected the text becomes "Now sweep across the meadow"; 5 "Drag the sun to change the time of day"; 6 "Turn the season dial" — the pulsing ring highlights the dial. Finally: "That’s the whole glass — press U to hide the controls". Tips already done are skipped, and the tutorial does not return on later visits.
- **Loading screen.** A near-black warm screen (a soft radial gradient from `#1b1916` to `#0d0c0b`) with "Weatherglass" in the serif at 34px and, beneath it in small widely spaced capitals, "sealing the atmosphere…", gently pulsing. It fades out over about a second and a half once the scene is ready.
- **Phones and small windows.** The toolbar stays at the bottom centre. The time and climate panels fold away into a drawer that springs up above the toolbar from a square button with a small dial icon beside the toolbar. In the drawer the climate panel shows the temperature and weather phrase on the left and the dial on the right. Hints move to the top of the screen. Everything works by touch: one finger for tools and orbiting, two fingers to zoom and orbit.
- **Accessibility.** Every control is reachable and operable by keyboard with a visible brass focus ring, has a spoken label, and the time track and season dial behave as sliders (arrow keys nudge; Home and End jump). Animations are reduced when the system asks for reduced motion.

Tooltip table:
| Tool | Key | Line |
|---|---|---|
| Hand | 1 | Grab & fling clouds · hold still to squeeze rain · shake for lightning · drag the sun |
| Wind | 2 | Sweep across the land to blow |
| Cloud | 3 | Press in the sky to condense a cloud |
| Fog | 4 | Brush mist into the valley |
| Wipe | 5 | Wipe condensation off the glass |

## 16. Sound

All sound is generated; it starts on the user's first interaction and can be muted. Sounds come from the left or right according to where their source appears on screen, and shift as the camera orbits.

**Ambience, always evolving:** wind (airy rush with gusts, papery leaf rustle when leaves exist, hollow howl in storms); rain (patter to hiss to low roar); snow (very quiet hush); water (waterfall wash, river babble, gurgles; louder after rain, silent frozen); birdsong by day (warbles, whistles, trills, chirps, dove coo, cuckoo in spring), dawn chorus, dusk, silent in storms; owl at night, mostly autumn; crickets warm summer nights, faster when warmer; frogs on mild spring nights. A barely audible low room tone.

**Events:** lightning (sharp crack at flash instant, rolling thunder later/farther); clouds (soft airy grab, wet rubbery squish while squeezing, breathy whoosh on release, deep double thump on merge, small pop for new cloud, static crackle from charged cloud in hand); water (plunk-and-spray splash, drips); glass (clear different-pitched tink per pane, wet squeak while wiping); wind tool (rushing sweep follows stroke); fog/trees (soft whoosh); interface (tick on tool change, faint tink on dial detents, small pop toggles); chime (three or four soft rising bell notes for special moments — only musical sound).

## 17. Preset scenes

The page starts on **calm**. These presets can be chosen with `?scenario=name` in the address, and are useful for checking the look:

| Name | Season, time | What you see |
|---|---|---|
| `calm` | spring, 15:14 | three white clouds, blossom, sunshine |
| `rain` | start of summer, 13:12 | two grey clouds already raining over the meadow and the lake, wet ground, a higher lake |
| `storm` | summer, 15:50 | a huge black anvil cloud with lightning, a second storm cell, heavy rain, strong wind, lit windows |
| `snow` | midwinter, 10:48 | everything white, frozen lake, bare trees, two clouds snowing |
| `mountainsnow` | autumn, 10:04 | autumn colours below, snow on the peaks, rain clouds over the mountains |
| `fog` | autumn, 06:57 | dawn, thick fog in the valley and over the lake, misted glass |
| `autumn` | autumn, 13:55 | full autumn colour, a gusty wind, leaves flying |
| `night` | summer, 23:02 | stars, moonlight, fireflies, lit windows |
| `dusk` | summer, 17:38 | low orange sun, long shadows, peach clouds |

## 18. Constraints and quality

- **One HTML file.** No external images, models, fonts or audio: everything is generated in code, and the landscape is identical on every load.
- **Runs smoothly on phones and laptops.** Detect the device's graphics capability and choose one of three detail levels, then keep adjusting sharpness to hold a smooth frame rate. Lower levels reduce the number of grass blades (20,000 / 60,000 / 120,000), trees, flowers, particles, stars and animals, the sharpness of shadows and the smoothness of clouds and fog, and drop the lake's mirror reflection and the tilt-shift blur. They never remove a feature or a connection between systems.
- If one part fails, the rest must keep running.

**Check before you finish:**

1. The opening view matches section 2.
2. Grabbing, squeezing, shaking, flinging and merging clouds all work and feel soft and physical.
3. Rain visibly wets the ground, makes puddles, raises the lake and swells the waterfall; a merged storm strikes the tallest trees with thunder.
4. Dragging the sun runs through golden hour, dusk and a starry night with lit windows and fireflies.
5. Turning the dial runs through blossom, summer, autumn leaf fall and snow; in winter the lake and waterfall freeze.
6. Fog pours, flows downhill and burns off; the glass mists, drips, frosts and can be wiped.
7. The interface matches section 15 on desktop and phone.
8. Sound follows all of it.

Priorities, in order: how good it feels to handle a cloud; the chain of cause and effect; the look of a real photographed miniature; everything else.