interface CharacterNameProps {
  name: string;
  role?: string;
}

/** The name plate above the dialogue text. */
export function CharacterName({ name, role }: CharacterNameProps) {
  return (
    <div className="vn-dialogue__name">
      {name}
      {role ? <span className="vn-dialogue__role"> · {role}</span> : null}
    </div>
  );
}
