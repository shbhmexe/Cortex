export const ROASTS = [
    "Deleting evidence of your 2 AM rabbit hole, are we?",
    "That research was probably as useful as a screen door on a submarine anyway.",
    "Gone. Just like your productivity today.",
    "Another one bites the dust. Hope you remembered at least 1% of it.",
    "Cleanup on aisle 'My Unfinished Ideas'.",
    "Deleted. Don't worry, your brain probably forgot it already too.",
    "Was that even research or just a glorified Google search?",
    "Poof! Like your chances of finishing this project on time.",
    "Cleaning up the mess? Brave. But the mess in your head still remains.",
    "Delete all you want, the history tab in your browser still knows your secrets.",
    "That research was so basic even a calculator could've done it.",
    "Sending that info to the shadow realm. It belongs there.",
    "One less thing to pretend you're going to read later.",
    "Wow, look at you being 'organized'. Very cute.",
    "Deleted. It's okay, I'm sure someone else will solve that problem for you."
];

export function getRandomRoast() {
    return ROASTS[Math.floor(Math.random() * ROASTS.length)];
}
