Beacon MVP Spec
Simple version
1. Product in one sentence
Beacon lets you turn a valuable LLM conversation into a matchable inquiry and see who else is thinking about the same thing — or who can add value to your exploration.

2. The core idea
People already use ChatGPT, Claude, and other LLMs to think through ideas.
Sometimes a conversation becomes more than a chat:
a new theory
a research thread
a startup idea
an unresolved question
a topic where the user wants more brains on it
Right now, that usually dies inside a private thread.
Beacon’s job is to create one simple new behavior:
Had an interesting exploration with your LLM? Beacon it.
Then:
save the inquiry
structure it
make it optionally discoverable
show relevant people/inquiries
That is the MVP.

3. Product promise
User promise
When you have a good thought inside your LLM, Beacon helps you turn it into a socially actionable object.
MVP promise
One click from LLM conversation → Beacon → relevant people.

4. Who this is for
Initial user
People who use LLMs as thought partners:
founders
researchers
engineers
power users
intellectually curious people who go down rabbit holes
Not for initial launch
casual users doing one-off tasks
users who do not want to meet anyone
users who only want public posting

5. The MVP goal
Validate one core behavior:
A user has an interesting LLM conversation, turns it into a Beacon, and finds at least one person or inquiry that feels meaningfully relevant.
If that happens, the concept is real.

6. What the MVP is
The MVP is made of only two surfaces:
A. Capture surface
Inside or adjacent to an LLM workflow.
Main action:
@Beacon this
or “Export to Beacon”
This creates a draft Beacon from the current conversation.
B. Web app
A very simple web app where the user can:
see saved Beacons
edit them
turn matching on/off
see related Beacons / people
request an intro
That’s it.

7. What the MVP is not
Do not build:
a new LLM interface
a full social network
a feed
public posting
graph/garden UI
complex privacy settings
cross-LLM cataloging as the headline feature
communities/circles
enterprise features
This MVP should feel almost painfully simple.

8. Core object: the Beacon
A Beacon is a structured version of a live inquiry.
Required fields
Title
Summary
What I’m exploring
What I want help with
Tags
Open to matching? yes/no
Optional fields
source LLM
source timestamp
desired match type
current stage
Example
Title: Psychedelics and microtubule dynamics
Summary: Exploring whether psychedelics could affect microtubule behavior directly or indirectly.
What I’m exploring: mechanistic plausibility, related literature, possible experimental angles
What I want help with: cell biology expertise, counterarguments, relevant papers
Tags: psychedelics, neuroscience, microtubules
Open to matching: yes
This is enough.

9. The magic moment
The user has an interesting chat and says:
@Beacon this
Beacon creates a clean card representing the thought.
Then, if matching is on, Beacon says something like:
“2 people are exploring something very similar”
“1 person may have expertise that helps this inquiry”
“1 related inquiry may be worth looking at”
That is the product moment.

10. Primary user flow
Flow 1: Create Beacon from LLM conversation
Trigger
User invokes:
@Beacon this
or “Export to Beacon”
System action
Extract from conversation:
title
summary
what user is exploring
what user wants help with
tags
Review screen
User sees the draft and can:
edit
save privately
save and open to matching
discard
Success state
Beacon is created in the web app.

11. Secondary user flow
Flow 2: View Beacon in web app
On the Beacon detail page, user sees:
the Beacon card
edit button
matching toggle
related Beacons / people
Actions:
turn matching on/off
request intro
archive Beacon

12. Matching behavior
This should be dead simple in v1.
The system should match Beacon to Beacon.
Match types
Only support 3:
Same topic
Adjacent angle
Can help you
That’s enough.
Example outputs
“Exploring the same topic”
“Approaching this from a different but related angle”
“May have useful expertise for your question”
Do not overcomplicate with lots of labels.

13. Intro behavior
Keep intros extremely lightweight.
User sees match
For each match:
title
short summary
why it matched
request intro
If request is mutual
The system:
notifies both users
creates a lightweight intro thread or email handoff
That’s enough for MVP.
No need for full social messaging product.

14. Privacy / sharing model
Keep this very simple.
Rules
Nothing is Beaconed unless the user explicitly chooses to Beacon it.
Every Beacon is private by default.
User can turn matching on for that Beacon.
That is the whole sharing model for MVP.
No complicated privacy architecture needed.

15. MVP screens
Only build these:
1. Landing page
Headline:
Turn your best LLM rabbit holes into Beacons. Discover who else is thinking about the same thing.
CTA:
Try Beacon
Join waitlist
2. Import / Review screen
After @Beacon this
title
summary
what I’m exploring
what I want help with
tags
matching toggle
save button
3. Dashboard
Shows all saved Beacons as cards.
Each card:
title
short summary
tags
matching on/off
created date
4. Beacon detail page
Shows full Beacon plus related matches.
5. Match inbox
Simple list of:
related Beacons
intro requests
accepted intros
That’s all you need.

16. Data model
User
id
name
email
created_at
Beacon
id
user_id
title
summary
exploring
help_wanted
tags
source_llm
is_matchable
status
created_at
Match
id
beacon_id
matched_beacon_id
match_type
reason
score
created_at
IntroRequest
id
from_user_id
to_user_id
beacon_id
matched_beacon_id
status
created_at
That’s enough.

17. Matching engine, simplest possible version
Do not overengineer.
Input
title
summary
exploring
help_wanted
tags
Matching logic
embedding similarity for topic overlap
keyword/tag overlap
basic “help wanted” vs “exploring” complementarity
active/matchable filter
Output
Top 3–5 matches only.
Rule
Better to show:
3 interesting results
Than:
20 weak ones

18. MVP value even before network density
This matters a lot.
Beacon should still be useful even if no matches appear yet.
It should help users:
preserve important LLM explorations
turn them into reusable inquiry cards
build a simple library of interesting thoughts
That way the product has some single-player value from day one.

19. What makes this MVP powerful
Even though it is simple, it captures the real vision because it introduces the essential primitive:
The primitive
A live LLM exploration can become a Beacon:
structured
saved
optionally social
routable to relevant people
That is the whole company in seed form.
Everything else can come later.

20. What to market
Market the product with one sharp message:
Core message
Had an interesting thought with your LLM? Beacon it. See who else is thinking about it — or who can help.
Alternative
Turn your best LLM rabbit holes into discoverable inquiry cards.
Product language
“Save this thought”
“Open this to matching”
“See who else is on this”
“Find relevant people around your inquiry”
Keep it concrete.

21. Success criteria
The MVP is working if:
users create Beacons from real LLM conversations
a meaningful % turn matching on
some users request intros
some matches feel surprisingly good
users create a second Beacon
North star
Useful matches per active user
Secondary:
Beacon creation rate
% of Beacons opened to matching
intro request rate
repeat usage

22. What to fake manually at first
Absolutely acceptable in MVP:
manual curation of matches
manual ranking cleanup
manual intro brokering
manual onboarding
You are validating the behavior, not building the final machine.

23. Build order
Phase 1
landing page
auth
Beacon data model
manual Beacon creation
dashboard
Beacon detail page
Phase 2
@Beacon this capture flow
draft extraction + review
basic matching
intro request flow
Phase 3
improve ranking
better messaging
better onboarding
better match explanations

24. Final MVP definition
Beacon MVP is a simple web app plus LLM capture flow that lets users turn valuable LLM conversations into structured inquiry cards and optionally discover others exploring similar ideas or able to help.
That is the simplest version that still captures the real power of the idea.
I can turn this next into a polished one-pager you can actually send around to early users or post publicly.

