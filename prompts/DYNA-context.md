**so in a directory like .cargo/bin or .local/bin there is an env file, i want you to think about this file when you are working.**

# Dynamic Context File Reloading:

essentially we are going to design a background agent for the robo edition of this agent that scans the transcripts and sees where the context files are getting in the way of the agent, and update them. We need to design a way to these files to automatically get pruned from and reloaded in context when this happens.

the same is true for the docs/ directory. We will make them availible to the agent and when they get updated they need to automatically reload.
