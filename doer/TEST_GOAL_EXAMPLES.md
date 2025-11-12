# AI Plan Generation Test Goals

Comprehensive test cases for validating the scheduler fixes and AI plan generation system.

---

## Category 1: Timeline Length Tests

### 1.1 Single Day Goal (Tight Timeline)
```
I need to prepare a presentation for tomorrow morning. I have to research the topic, create slides, write speaker notes, and practice my delivery. The presentation should be 10 minutes long and cover the basics of project management. I need to complete everything today.
```
**Expected**: 1 day plan, all tasks scheduled on same day, capacity validation

### 1.2 Two-Day Goal (Original Test Case)
```
I need to prepare for an important remote job interview happening in two days. I haven't organized my resume files, my portfolio is outdated, and I haven't practiced interview answers in a long time. I also need to research the company, set up my interview space so it looks clean and professional, and run a tech check for my camera, mic, and lighting. I'd like a structured plan that helps me update my resume and portfolio, prepare talking points, research the company, practice mock questions, and finalize my interview setup before the end of day two.
```
**Expected**: 2-3 day plan, backfilling available time slots, no split tasks

### 1.3 One Week Goal (Medium Timeline)
```
I want to learn the basics of Python programming in one week. I'm a complete beginner and need to understand variables, loops, functions, and be able to write simple programs. I have about 2 hours available each evening after work. By the end of the week, I want to build a simple calculator program.
```
**Expected**: 7 day plan, distributed tasks, evening scheduling consideration

### 1.4 Two Week Project
```
I'm planning to redecorate my home office in the next two weeks. I need to research furniture options, measure the space, choose a color scheme, order supplies, paint the walls, assemble new furniture, organize cables, and set up my equipment. I can work on this mainly on weekends but have some evenings free during the week.
```
**Expected**: 14 day plan, weekend-heavy scheduling, extended timeline handling

---

## Category 2: Complexity Tests

### 2.1 Simple Goal (Low Task Count)
```
I need to organize my digital photos this weekend. I want to create folders by year and event, delete duplicates, and back everything up to the cloud.
```
**Expected**: 3-4 tasks, 1-2 days, straightforward scheduling

### 2.2 Complex Goal (High Task Count)
```
I'm launching a small online business in the next three weeks. I need to develop the business concept, research competitors, create a business plan, design a logo, build a website, set up social media accounts, create initial content, establish payment processing, write product descriptions, plan marketing strategy, set up email marketing, create promotional materials, and soft-launch to friends and family. I can dedicate about 4 hours per day to this.
```
**Expected**: 12-15 tasks, 21 day timeline, priority distribution, potential capacity issues

### 2.3 Multi-Phase Goal
```
I want to get in shape for a 5K race in one month. I'm currently sedentary and need to start slow. I need to get proper running shoes, create a training schedule, start with walk/run intervals, gradually increase distance, improve my diet, do strength training twice a week, practice proper running form, track my progress, and do a practice 5K at the end.
```
**Expected**: Recurring tasks, gradual progression, 30 day plan

---

## Category 3: After-Hours Creation Tests

### 3.1 Evening Creation (After 5 PM)
```
I need to clean and organize my garage tomorrow. Sort items into keep/donate/trash piles, sweep the floor, install shelving units, organize tools, label storage bins, and clean out the car.
```
**Expected**: When created after 5 PM, should start next day at 9 AM, not try to schedule anything today

### 3.2 Late Night Creation (After 10 PM)
```
Tomorrow I need to meal prep for the week. Plan meals, make grocery list, go shopping, prep vegetables, cook proteins, portion meals into containers, and clean up the kitchen.
```
**Expected**: Start tomorrow morning, proper date adjustment, no currentTime passed to scheduler

---

## Category 4: Tight Timeline / Capacity Tests

### 4.1 Ambitious Single Day
```
Today I need to finish my thesis edits, submit the final version, update my LinkedIn profile, apply to five jobs, prepare for tomorrow's interview, and organize my reference materials. It's urgent and everything must be done by end of day.
```
**Expected**: Capacity warning if exceeds 252 minutes, potential timeline extension suggestion

### 4.2 Barely Fits Timeline
```
I have exactly 8 hours of work spread over 2 days: write a 10-page report (4 hours), create supporting charts (2 hours), proofread everything (1 hour), and submit with cover letter (1 hour).
```
**Expected**: Should fit within 2 days (504 min capacity), efficient scheduling

### 4.3 Exceeds Timeline (Should Auto-Extend)
```
In the next 24 hours I need to: deep clean entire house (3 hours), do all laundry (2 hours), grocery shopping (1.5 hours), cook meals for the week (3 hours), organize closets (2 hours), wash car (1 hour), yard work (2 hours), and prepare for next week (1 hour).
```
**Expected**: Timeline auto-extension, proper day_index for extended schedules

---

## Category 5: Priority Distribution Tests

### 5.1 Critical Priority Heavy
```
I have a critical deadline tomorrow. I must finish the client presentation, get approval from my manager, make final edits, prepare backup materials, and print physical copies. Every task is urgent and time-sensitive.
```
**Expected**: All Priority 1-2 tasks, sequential ordering on same day

### 5.2 Mixed Priority
```
This week I want to learn basic web development. I should start with HTML fundamentals, then CSS basics, and finally JavaScript introduction. I'd also like to set up a portfolio site, explore some tutorials, and maybe join an online community. The learning should follow a logical progression but the extra activities are flexible.
```
**Expected**: Mix of Priority 1-4, logical sequencing for learning tasks, flexibility for optional tasks

### 5.3 Low Priority Heavy (Nice-to-Have)
```
I have some free time this weekend and want to do some personal development. Maybe watch some educational videos, organize my bookmarks, try a new recipe, read a few articles I saved, clean my desk, update my personal budget spreadsheet, and call an old friend.
```
**Expected**: Mostly Priority 3-4, relaxed scheduling, easy to reschedule

---

## Category 6: Clarification Trigger Tests

### 6.1 Vague Goal (Should Trigger Clarifications)
```
I want to learn guitar.
```
**Expected**: AI asks about experience level, time available, specific goals, timeline

### 6.2 Ambiguous Timeline
```
I need to organize my life. Start exercising, eat healthier, improve my career skills, and spend more time with family.
```
**Expected**: AI asks about priorities, timeline expectations, current situation

### 6.3 Missing Key Details
```
I want to build a mobile app. I have an idea but need to figure out the rest.
```
**Expected**: AI asks about technical skills, platform, app complexity, timeline

---

## Category 7: Specific Schedule Constraint Tests

### 7.1 Morning Person
```
I'm a morning person and have the most energy from 6 AM to 12 PM. I need to write three blog posts this week, each requiring about 2 hours of focused work. I also need to edit photos for social media and schedule posts.
```
**Expected**: Tasks should respect workday hours setting in user preferences

### 7.2 Evening Availability
```
I work full-time 9-5 and can only work on my side project in the evenings from 7-10 PM. I need to finish developing a feature, write documentation, fix bugs, and deploy to production. This should take about a week.
```
**Expected**: Consider user's available hours, might need clarification about workday settings

---

## Category 8: Recurring/Habit Formation Tests

### 8.1 Daily Habits
```
For the next 30 days, I want to establish a morning routine: wake up at 6 AM, meditate for 10 minutes, exercise for 30 minutes, have a healthy breakfast, and review my goals for the day. I want this to become automatic.
```
**Expected**: Recurring tasks, consistent daily schedule, 30 day plan

### 8.2 Weekly Recurring
```
I want to dedicate the next month to learning Spanish. I should practice with an app daily (20 minutes), have a tutoring session twice a week (1 hour each), watch Spanish media three times a week, and complete weekly grammar exercises.
```
**Expected**: Mix of daily and weekly recurring tasks

---

## Category 9: Edge Cases & Stress Tests

### 9.1 Extremely Short Tasks
```
I need to do quick admin tasks today: reply to 3 emails (5 min each), make 2 phone calls (10 min each), update my calendar (5 min), file expense report (15 min), and send meeting invites (10 min).
```
**Expected**: Many short tasks, efficient time slot allocation, no gaps

### 9.2 Very Long Tasks
```
I need to write my Master's thesis over the next 3 weeks. Writing the introduction (6 hours), literature review (10 hours), methodology (5 hours), results (8 hours), discussion (6 hours), conclusion (3 hours), bibliography (2 hours), and final editing (4 hours).
```
**Expected**: Large tasks split across multiple days properly, realistic daily capacity

### 9.3 Exact Capacity Match
```
I have exactly 4.2 hours of work to complete today during my 9-5 workday (accounting for lunch): Task A (60 min), Task B (45 min), Task C (90 min), Task D (57 min).
```
**Expected**: Perfect fit, efficient scheduling, no wasted time

---

## Category 10: Real-World Scenarios

### 10.1 Event Planning
```
I'm hosting a dinner party in 5 days. I need to plan the menu, make shopping lists, send invitations, clean the house, buy ingredients, prep food the day before, set the table, and cook the day of. I'm expecting 8 guests.
```
**Expected**: Logical task sequencing, time-appropriate scheduling (cooking closer to event)

### 10.2 Moving Preparation
```
I'm moving in 2 weeks. I need to sort and pack belongings, sell unwanted items, arrange movers, transfer utilities, update my address everywhere, clean my current place, buy packing supplies, pack room by room, label boxes, and prepare an essentials box.
```
**Expected**: 14 day plan, logical dependency ordering, realistic time estimates

### 10.3 Exam Preparation
```
I have a major certification exam in 10 days. I need to review all 12 chapters of the study guide, take practice tests, review my weak areas, make flashcards, join a study group, and do a final review the day before.
```
**Expected**: Study-focused scheduling, logical progression, review tasks near end

### 10.4 Career Transition
```
I'm changing careers in the next month. I need to update my resume for the new field, get certified in a relevant skill, build a portfolio of 3 projects, network with people in the industry, apply to jobs, prepare for interviews, and update my LinkedIn. I have evenings and weekends available.
```
**Expected**: 30 day plan, complex task breakdown, evening/weekend consideration

---

## Testing Protocol

### For Each Goal Test:

1. **Create Plan at Different Times**:
   - Morning (9 AM) - within workday
   - Evening (6 PM) - after workday
   - Late night (11 PM) - well after workday

2. **Verify Expected Behavior**:
   - ✅ Correct start date/time
   - ✅ No split tasks
   - ✅ Proper day_index values
   - ✅ Tasks scheduled in priority order
   - ✅ Available capacity utilized (backfilling)
   - ✅ Extended timeline if needed
   - ✅ Realistic time estimates

3. **Check Database**:
   - ✅ Plan record correct
   - ✅ All tasks created
   - ✅ All schedules created
   - ✅ No orphaned data
   - ✅ day_index sequential and accurate
   - ✅ Clarifications stored if applicable

4. **Review Logs**:
   - ✅ Date adjustment messages
   - ✅ isToday status
   - ✅ currentTime values
   - ✅ Scheduler capacity analysis
   - ✅ Task placement decisions

---

## Success Criteria

A successful test means:
- Plan generates without errors
- All tasks scheduled as complete blocks (no splitting)
- Schedules respect workday hours
- Priority-based ordering maintained
- Available time slots utilized efficiently
- Extended timelines handled correctly with proper day_index
- Clarifications triggered appropriately
- Database integrity maintained

---

## Quick Test Commands

```bash
# Test after-hours creation
# (Create plan at 11 PM, verify starts tomorrow at 9 AM)

# Test tight timeline
# (Use "Ambitious Single Day" goal, verify capacity handling)

# Test backfilling
# (Use "Two-Day Goal", verify tasks fill available slots)

# Test extended timeline
# (Use "Exceeds Timeline" goal, verify day_index correctness)
```




