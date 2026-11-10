// Everything about the members on the Team page (/team/). Edit the text here.
//
// Photos: put a picture in src/assets/team/ named after the `photo` key, e.g. walid.jpg
// (capitals don't matter). jpg, jpeg, png, webp or avif all work and replace the .svg placeholder.

export interface Member {
  name: string;
  photo: string;
  role: string;
  /** Background colour behind the photo (from the Gulzilla palette). */
  color: string;
  bio: string;
}

export const TEAM = {
  name: 'Team 12',
  client: 'J.E.F',
  concept: 'Monster Run',
};

export const MEMBERS: Member[] = [
  {
    name: 'Walid El Kaddouri',
    photo: 'walid',
    role: 'Visual design',
    color: '#FF8A3D',
    bio: "Walid drew our monster and is in charge of how everything looks. He went through a lot of title and font tryouts before we landed on the Gulzilla logo, and checked our colours with a colour blindness simulator.",
  },
  {
    name: 'Bryan Deketelaere',
    photo: 'bryan',
    role: 'Development',
    color: '#8DBE45',
    bio: 'Bryan does most of the coding: the game itself, the rhythm and getting the controls to talk to the screen. He also built this blog so we could keep track of everything.',
  },
  {
    name: 'Alexander Jonckheere',
    photo: 'alexander',
    role: '3D & development',
    color: '#8CCBFF',
    bio: "Alexander turns Walid's drawings into a 3D monster in Blender. It took him three attempts, and auto-rigging didn't work, so he rigged and animated it himself. When he's not in Blender he helps with the code.",
  },
];
