import type { DefaultThemeRenderContext } from "../DefaultThemeRenderContext.js";
import { JSX } from "../../../../utils/index.js";
import type { ReferenceReflection } from "../../../../models/index.js";

void JSX; // Trick TS into seeing this as used, the import is required.

export const memberReference = (
    { urlTo, i18n, commentSummary, commentTags }: DefaultThemeRenderContext,
    props: ReferenceReflection,
) => {
    const referenced = props.tryGetTargetReflectionDeep();

    if (!referenced) {
        return (
            <>
                {i18n.theme_re_exports()} {props.name}
                {commentSummary(props)}
                {commentTags(props)}
            </>
        );
    }

    if (props.name === referenced.name) {
        return (
            <>
                {i18n.theme_re_exports()} <a href={urlTo(referenced)}>{referenced.name}</a>
                {commentSummary(props)}
                {commentTags(props)}
            </>
        );
    }

    return (
        <>
            {i18n.theme_renames_and_re_exports()} <a href={urlTo(referenced)}>{referenced.name}</a>
            {commentSummary(props)}
            {commentTags(props)}
        </>
    );
};
