import { classNames, getDisplayName, hasTypeParameters, join } from "../../lib";
import { JSX } from "../../../../utils";
import type { DefaultThemeRenderContext } from "../DefaultThemeRenderContext";
import { ReflectionKind } from "../../../../models";
import type { HtmlOutputDocument } from "../../../html-output";

export const header = (context: DefaultThemeRenderContext, props: HtmlOutputDocument) => {
    const HeadingLevel = props.model.isProject() ? "h2" : "h1";
    return (
        <div class="tsd-page-title">
            {!!props.model.parent && <ul class="tsd-breadcrumb">{context.breadcrumb(props.model)}</ul>}
            <HeadingLevel class={classNames({ deprecated: props.model.isDeprecated() })}>
                {props.model.kind !== ReflectionKind.Project && `${ReflectionKind.singularString(props.model.kind)} `}
                {getDisplayName(props.model)}
                {hasTypeParameters(props.model) && (
                    <>
                        {"<"}
                        {join(", ", props.model.typeParameters, (item) => item.name)}
                        {">"}
                    </>
                )}
                {context.reflectionFlags(props.model)}
            </HeadingLevel>
        </div>
    );
};
