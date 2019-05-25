import * as React from "react";

export function HelloMessage(props: { name: string }): React.ReactNode {
    return <div>Hello {props.name}</div>;
}
