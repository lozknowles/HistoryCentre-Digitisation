/** Symbolic vector illustrations. Never presented as photographs of holdings. */
export function ItemArt({
  category,
  seed = 0,
}: {
  category: string;
  seed?: number;
}) {
  const colors = ["#ded9c8", "#e2d4c6", "#d5ddcc", "#d8dbd1", "#dfd7c9"];
  const base = colors[seed % colors.length];
  const ink = "#516050",
    light = "#fcf7e8",
    mid = "#b0a385";
  let drawing;
  if (category.startsWith("Photograph"))
    drawing = (
      <g transform="rotate(-7 160 108)">
        <rect x="62" y="24" width="195" height="158" rx="2" fill={light} />
        <rect x="73" y="35" width="173" height="126" fill="#a9b2a1" />
        <circle cx="213" cy="61" r="14" fill="#e4dcc1" />
        <path
          d="M73 137L119 100L147 118L185 84L246 139V161H73Z"
          fill="#788a73"
        />
        <path d="M99 102L123 82L146 102V143H99Z" fill="#d9ccb0" />
        <path
          d="M92 103L123 76L153 103"
          fill="none"
          stroke={ink}
          strokeWidth="7"
        />
        <path d="M119 120H130V143H119ZM104 112H113V121H104Z" fill={ink} />
      </g>
    );
  else if (category.startsWith("Clothing"))
    drawing = (
      <g>
        <path
          d="M124 31L102 39L74 75L101 98L115 83L106 177H214L205 83L219 98L246 75L218 39L195 31Q160 56 124 31Z"
          fill="#8f9b87"
          stroke={ink}
          strokeWidth="2"
        />
        <path
          d="M124 31L160 69L195 31M160 69V177M107 160H211"
          fill="none"
          stroke="#c5c9b4"
          strokeWidth="3"
        />
        {[84, 106, 128, 150].map((y) => (
          <circle key={y} cx="167" cy={y} r="3" fill={light} />
        ))}
      </g>
    );
  else if (category.startsWith("Books"))
    drawing = (
      <g transform="rotate(-9 160 110)">
        <rect x="98" y="35" width="131" height="158" rx="6" fill="#526e62" />
        <rect
          x="93"
          y="26"
          width="131"
          height="157"
          rx="5"
          fill="#6e8674"
          stroke={ink}
          strokeWidth="2"
        />
        <path
          d="M110 26V183M119 46H205V159H119Z"
          fill="none"
          stroke="#cbbd93"
          strokeWidth="2"
        />
        <path
          d="M135 74H189M132 87H192M144 115H180"
          stroke="#d6c8a4"
          strokeWidth="3"
        />
        <path d="M115 185H220" stroke={light} strokeWidth="4" />
      </g>
    );
  else if (category.startsWith("Helmet"))
    drawing = (
      <g>
        <path
          d="M88 130Q86 45 163 43Q239 47 232 130Z"
          fill="#788375"
          stroke={ink}
          strokeWidth="3"
        />
        <ellipse
          cx="160"
          cy="131"
          rx="105"
          ry="20"
          fill="#65725f"
          stroke={ink}
          strokeWidth="3"
        />
        <path
          d="M113 61Q92 97 101 118M164 43V113"
          fill="none"
          stroke="#aeb79d"
          strokeWidth="4"
        />
        <path
          d="M114 151Q141 198 185 160"
          fill="none"
          stroke="#75684c"
          strokeWidth="9"
        />
        <rect x="151" y="73" width="22" height="29" rx="3" fill="#bbab7d" />
      </g>
    );
  else if (category.startsWith("Bottles"))
    drawing = (
      <g>
        <rect x="130" y="32" width="60" height="17" rx="3" fill="#8c7855" />
        <path
          d="M135 49V74L114 96V180Q160 196 207 180V96L186 74V49Z"
          fill="#8a673a"
          stroke="#72532f"
          strokeWidth="3"
        />
        <path
          d="M127 105V170M144 57V76"
          stroke="#c2a06b"
          strokeWidth="6"
          opacity=".6"
        />
        <rect x="133" y="108" width="57" height="55" rx="2" fill="#e7d9b3" />
        <path
          d="M141 122H182M146 132H177M143 145H180"
          stroke="#8c7855"
          strokeWidth="2"
        />
        <text x="161" y="157" textAnchor="middle" fontSize="6" fill="#766045">
          ARCHIVE STUDY
        </text>
      </g>
    );
  else if (category.startsWith("Maps"))
    drawing = (
      <g transform="rotate(-5 160 110)">
        <path
          d="M51 38L119 28L195 40L267 29V178L195 189L119 177L51 187Z"
          fill="#f1e8cf"
          stroke="#b8b299"
          strokeWidth="2"
        />
        <path d="M119 28V177M195 40V189" stroke="#cfc5a9" strokeWidth="2" />
        <path
          d="M68 55Q153 68 137 112T252 167"
          fill="none"
          stroke="#8daeb0"
          strokeWidth="12"
        />
        <path
          d="M65 149L117 104L201 95L251 53M77 53L92 76L196 156L246 150"
          fill="none"
          stroke="#aa9a75"
          strokeWidth="3"
        />
        <path d="M218 55V81M209 68H227" stroke={ink} strokeWidth="2" />
      </g>
    );
  else if (category.startsWith("Brochures"))
    drawing = (
      <g transform="rotate(5 160 110)">
        <path
          d="M71 29L128 40L188 29L248 40V183L188 172L128 183L71 172Z"
          fill={light}
          stroke="#b3b497"
          strokeWidth="2"
        />
        <path d="M128 40V183M188 29V172" stroke="#d0ccb5" strokeWidth="2" />
        <rect x="79" y="50" width="40" height="54" fill="#889b7d" />
        <path
          d="M139 63H178M139 76H178M139 89H178M199 56H239M199 70H239M81 119H117M81 133H117M199 99L223 86L239 104V130H199Z"
          stroke="#9aa282"
          strokeWidth="3"
          fill="none"
        />
      </g>
    );
  else if (category.startsWith("Domestic"))
    drawing = (
      <g>
        <ellipse cx="153" cy="70" rx="53" ry="16" fill="#687768" />
        <path
          d="M100 70L90 151Q87 190 153 193Q216 190 213 151L206 70Q158 88 100 70Z"
          fill="#c4b28c"
          stroke="#8d896e"
          strokeWidth="3"
        />
        <path
          d="M208 93Q264 83 252 126Q246 145 215 143"
          fill="none"
          stroke="#a69b7b"
          strokeWidth="13"
        />
        <path
          d="M99 116Q153 132 210 116M94 145Q153 161 213 145"
          fill="none"
          stroke="#8e9a7d"
          strokeWidth="6"
        />
      </g>
    );
  else if (category.startsWith("Tools"))
    drawing = (
      <g transform="rotate(-15 160 110)">
        <path
          d="M58 135H252L267 156H58Z"
          fill="#9b8059"
          stroke="#75674d"
          strokeWidth="3"
        />
        <path
          d="M89 99H218V136H74Z"
          fill="#b69a72"
          stroke="#75674d"
          strokeWidth="3"
        />
        <path d="M143 101L165 47L190 55L169 113Z" fill="#667467" />
        <path
          d="M201 105V66Q214 51 231 65V113"
          fill="none"
          stroke="#8e6e47"
          strokeWidth="16"
        />
        <circle cx="104" cy="96" r="13" fill="#7b6240" />
      </g>
    );
  else
    drawing = (
      <g transform="rotate(-5 160 110)">
        <path
          d="M91 27H213L234 48V185H91Z"
          fill={light}
          stroke="#beb495"
          strokeWidth="2"
        />
        <path d="M213 27V49H234" fill="#ddd0ac" />
        <path
          d="M110 57H184M110 77H211M110 92H207M110 108H209M110 124H180M110 148H153"
          stroke="#9e9a7e"
          strokeWidth="3"
        />
        <path d="M183 155L173 192L190 184L203 195L207 156" fill="#9c6e58" />
        <circle cx="195" cy="151" r="19" fill="#a9624c" />
        <circle
          cx="195"
          cy="151"
          r="11"
          fill="none"
          stroke="#c18662"
          strokeWidth="2"
        />
      </g>
    );
  return (
    <svg
      viewBox="0 0 320 220"
      role="img"
      aria-label={`Symbolic illustration: ${category}`}
      className="item-art"
    >
      <rect width="320" height="220" fill={base} />
      <ellipse cx="164" cy="195" rx="94" ry="9" fill={mid} opacity=".2" />
      <g className="art-object">{drawing}</g>
      <text
        x="17"
        y="205"
        fontSize="7"
        letterSpacing="2"
        fill={ink}
        opacity=".65"
      >
        ILLUSTRATION
      </text>
    </svg>
  );
}
