## ClipPipeline 1.0.0 (build 17)

### New in build 17
- **Notifications show the ClipPipeline film-strip icon** (not the Expo logo), tinted in the brand orange.
- The splash screen and Android themed icon use the ClipPipeline mark too.

### Build 16: email accounts
- **Create account** with your name, email and a password, right from the sign-in screen.
- **Forgot password?** sends you an email with a link to choose a new password (the link opens the ClipPipeline website, then sign in in the app).
- **Profile → Change password.** Accounts made with Google, Facebook or TikTok see **Set a password**, so you can also sign in with your email.
- The website (clippipeline.nonsostudio.com/admin) has the same: **Sign up**, **Forgot password?** and Profile → Password.

### Build 15: Make a video
- **Studio → Make a video:** upload, pick a style (Vice Night, Lagos Glow, Bold Pop, Clean Pro), pick music, ride a trending topic for TikTok, YouTube or Instagram, and Studio edits it for you: cuts pauses, captions, headlines on your key words, colour grade, sound effects, music under your voice and an outro.
- When it is ready: **Download**, **Publish** (caption, hashtags and platform filled in) or **Try another style**.
- Four original, royalty-free music tracks with previews, or use your own.

### Build 14: Studio
- Studio tab: projects, advanced editor (trim, split, reorder, templates), 23 motion-graphics templates, render, save to gallery, share and cross-post.

### Needs the server update
Studio, Make a video and the new email features work once the `feat/studio` backend is deployed (see DEPLOY.md). Reset emails need the mail settings in the server's `.env`.
