/** What the vending machine in the booth sells. New things appear as the nights go on; the shift card tells you. */
export type VendId = 'cola' | 'toffee' | 'mint' | 'coffee' | 'barley' | 'tonic' | 'tea';

export interface VendItem {
  id: VendId;
  name: string;
  cost: number; // tokens
  night: number; // first night it is sold
  blurb: string; // printed on the machine
  effect: string; // what it does, in plain words
}

export const VENDING: VendItem[] = [
  { id: 'cola', name: 'Bright-O Cola', cost: 1, night: 1, blurb: 'Sparkling. Cold. Bright as the morning!', effect: 'Steadies your nerves a good deal.' },
  { id: 'toffee', name: 'Pennant Treacle Toffee', cost: 1, night: 1, blurb: 'Chewy enough to stop your teeth chattering.', effect: 'Fills your wind. You can run for longer for a minute.' },
  { id: 'mint', name: 'Hollow Mints', cost: 2, night: 2, blurb: 'Clears the head. Clears the eyes.', effect: 'Shows you one thing that is wrong about the next visitor, if anything is.' },
  { id: 'coffee', name: 'Night Owl Coffee', cost: 2, night: 3, blurb: 'A cup in a tin. Keeps you up and them waiting.', effect: 'The next visitor waits twice as long before they lose patience.' },
  { id: 'barley', name: 'Barley Sugar', cost: 2, night: 4, blurb: 'Suck slowly. Walk softly.', effect: 'For a minute your footsteps make no sound at all.' },
  { id: 'tonic', name: "Sister's Tonic", cost: 4, night: 5, blurb: 'Brown bottle. No label. Tastes of pennies.', effect: 'Your next decision makes itself, and it is the right one.' },
  { id: 'tea', name: 'Sweet Tea', cost: 4, night: 6, blurb: 'Two sugars. Hot. Your mother\'s way.', effect: 'If something kills you tonight, you black out instead and wake at the desk. Once.' },
];

export const VEND_BY_ID: Record<VendId, VendItem> = Object.fromEntries(VENDING.map((v) => [v.id, v])) as Record<VendId, VendItem>;
