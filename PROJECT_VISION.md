# PROJECT_VISION.md

# F1ISL Platform Evolution

## Master Product & Technical Specification

---

# Introduction

You are joining the F1ISL project as the Lead Software Architect and Senior Full-Stack Engineer.

Your responsibility is not simply to implement features.

Your responsibility is to help evolve F1ISL into a premium, scalable, maintainable platform that can continue growing for many years.

You should think like an owner of the project.

You should challenge assumptions when appropriate.

You should always optimize for long-term quality rather than short-term implementation speed.

---

# The Vision

F1ISL is evolving from a website into a complete racing league platform.

The website should become the single home for everything related to the league.

Users should eventually be able to access exactly the same platform in two different ways:

* Through the website.
* Through an installed Progressive Web App (PWA).

These are **not** two different products.

They are two different entry points into the same application.

The website remains the single source of truth.

There must never be duplicated business logic, duplicated components, duplicated pages, duplicated APIs or duplicated maintenance.

Every feature should be implemented once and automatically become available everywhere.

---

# Collaboration Principles

This document describes the desired product vision.

It does **not** describe the implementation.

You have access to the complete repository.

You understand the codebase better than this document can.

Treat this document as the destination, not the route.

If, after reviewing the project, you determine that:

* the architecture should be different,
* the implementation order should change,
* some phases are unnecessary,
* existing functionality already solves part of the problem,
* additional foundational work is required,
* or there is a better technical solution,

explain why.

Recommend the better approach.

Challenge assumptions whenever appropriate.

Never blindly implement this document if doing so would produce an inferior solution.

Whenever the repository differs from assumptions made here:

* Explain the difference.
* Explain its impact.
* Recommend the better solution.
* Update the implementation roadmap.

---

# Core Engineering Principles

The platform should always maintain:

* One frontend
* One routing system
* One shared component library
* One design system
* One styling system
* One backend
* One authentication system
* One authorization model
* One API layer
* One deployment pipeline

Avoid duplicated implementations.

Avoid technical debt.

Favor long-term maintainability.

---

# Long-Term Product Vision

Design the platform so future modules naturally integrate.

Current and future modules include:

* Homepage
* Schedule
* Results
* Championship Standings
* Drivers
* Teams
* News
* Articles
* Steward System
* League Administration
* User Accounts
* Driver Attendance
* Push Notifications
* Statistics
* Live Race Features
* Telemetry Integrations
* Commercial Features
* Future Mobile Enhancements

Every future module should integrate into the same architecture.

---

# Documentation

Before implementation, create or update two permanent project documents.

## ARCHITECTURE.md

This document becomes the technical reference for the project.

It should continuously describe:

* Overall architecture
* Folder structure
* Framework
* Routing
* Backend
* APIs
* Authentication
* Authorization
* Roles
* Data flow
* State management
* Caching
* PWA implementation
* Attendance architecture
* Notification architecture
* Deployment
* Major architectural decisions
* Reasons behind each decision

Every meaningful architectural decision should update this document.

---

## DESIGN_SYSTEM.md

This becomes the visual reference for the project.

Document:

* Brand philosophy
* Design principles
* Color palette
* Typography
* Spacing
* Grid system
* Layout rules
* Cards
* Buttons
* Forms
* Tables
* Inputs
* Dialogs
* Navigation
* Icons
* Status indicators
* Empty states
* Error states
* Loading states
* Motion
* Animations
* Accessibility
* Responsive behavior

Whenever reusable UI changes, update this document.

---

# Design Principles

F1ISL has one visual identity.

There is not:

* Website design
* App design

There is only:

The F1ISL Design System.

The installed PWA should simply present the same design system in an app-like experience.

Whenever possible:

Reuse components.

When new reusable components are required:

Add them to the shared design system.

Avoid isolated feature-specific UI.

---

# Development Strategy

This project must progress incrementally.

Never attempt to implement everything at once.

Every phase should begin with:

* Objective
* Scope
* Dependencies
* Files affected
* Risks
* Expected outcome

Large architectural work should be reviewed before implementation.

---

# Phase 1 — Technical Audit

Perform a complete audit.

Review:

* Framework
* Folder structure
* Routing
* Layouts
* Components
* Styling
* Responsiveness
* Backend
* APIs
* Authentication
* Existing permissions
* Steward module
* Existing administration
* Build process
* Performance
* Caching
* Deployment

Produce:

* Technical audit
* Technical debt
* Existing strengths
* Existing weaknesses
* Risks
* Opportunities
* Recommended improvements

Do not implement anything.

---

# Phase 2 — Architecture

Design the long-term architecture.

Ensure:

* Shared routes
* Shared layouts
* Shared components
* Shared APIs
* Shared styles
* Shared authentication
* Shared permissions
* Shared deployment

Document everything.

---

# Phase 3 — Progressive Web App

Transform the website into a premium installable PWA.

Implement:

* Manifest
* Icons
* Splash screen
* Theme colors
* Mobile metadata
* Installability
* Service Worker (only if appropriate)

Caching principles:

Static assets:

* Cache aggressively.

Dynamic league information:

* Prioritize freshness.

Especially:

* Results
* Standings
* Schedule
* Steward decisions
* Attendance
* News
* Admin information

Avoid stale data.

---

# Phase 4 — Premium Mobile Experience

Improve:

* Navigation
* Touch targets
* Mobile UX
* Information hierarchy
* Loading states
* Responsiveness
* Performance
* Accessibility

Do not build a different application.

Improve the existing application.

---

# Phase 5 — Authentication & Roles

Design a scalable permission model.

Suggested roles:

* Guest
* Registered User
* Driver
* Team Manager
* Steward
* League Administrator

Authentication should be shared between the website and the installed PWA.

---

# Phase 6 — Driver Attendance

Driver Attendance is a core platform feature.

It belongs to the website.

Because the PWA is the same application, it automatically exists there as well.

Drivers should be able to:

* View upcoming races
* See attendance opening date
* See attendance deadline
* Confirm attendance
* Decline attendance
* Respond "Maybe"
* Modify response before deadline
* View submitted response
* View attendance status

Attendance lifecycle:

* Not Open Yet
* Open
* Reminder Period
* Closing Soon
* Locked
* Race Completed

Store:

* Driver
* Race
* Status
* Response timestamp
* Last updated timestamp

Administrators should be able to:

* Open attendance
* Configure opening time
* Configure deadline
* View all responses
* Filter responses
* View missing responses
* Lock attendance
* Override attendance
* Export attendance

Design the data model so future features require minimal work.

Future roadmap:

* Push reminders
* Email reminders
* Discord reminders
* Reserve drivers
* Attendance history
* Reliability score
* Team dashboards
* Calendar integration

Document both architecture and reusable UI.

---

# Phase 7 — Notification Readiness

Prepare the platform for future notifications.

Examples:

* Race reminders
* Attendance opened
* Attendance deadline approaching
* Driver has not responded
* Steward verdicts
* Results
* News
* Championship updates
* League announcements

The notification infrastructure should support both the browser and the installed PWA without duplicated implementations.

---

# Phase 8 — Validation

After every phase verify:

* Desktop experience
* Mobile browser experience
* Installed PWA experience
* Shared components remain shared
* No duplicated logic
* Fresh dynamic data
* Authentication
* Permissions
* Attendance
* Responsive design

Run:

* Build
* Lint
* Type checks
* Responsive testing
* PWA validation

---

# General Engineering Principles

Always:

* Prefer maintainability.
* Prefer simplicity.
* Reuse existing code.
* Expand shared components.
* Avoid unnecessary dependencies.
* Explain major decisions.
* Preserve backwards compatibility whenever practical.
* Build for long-term growth.

If the repository already provides a solution:

Prefer extending it over replacing it.

If a better architecture exists:

Recommend it.

---

# Initial Review

Before writing production code:

Deliver:

1. Technical audit.
2. Risk assessment.
3. Existing strengths.
4. Existing weaknesses.
5. Architectural observations.
6. Initial ARCHITECTURE.md.
7. Initial DESIGN_SYSTEM.md.
8. Recommended implementation roadmap.

---

# Architecture Review

After completing the audit, stop implementation.

Switch into architecture review mode.

Assume you have just joined F1ISL as the Lead Software Architect.

Critically evaluate:

* This specification.
* The repository.
* The proposed roadmap.

Identify:

* Which assumptions were correct.
* Which assumptions were incorrect.
* Which phases should move.
* Which phases are unnecessary.
* Which foundational work is missing.
* Which existing functionality should be reused.
* Which implementation details should change because of the actual codebase.
* Which technical risks are highest.
* Which opportunities exist to simplify the project while still achieving the same vision.

Finally:

Present **your own recommended roadmap**.

Do not simply optimize mine.

If you believe a different roadmap would produce a cleaner, safer, more maintainable platform, explain why.

Your recommendation should balance:

* Long-term maintainability
* Scalability
* Simplicity
* User experience
* Development effort
* Technical risk

Only after we review and approve your proposed roadmap should implementation begin.

Think like the long-term owner of the platform, not just the implementer.
