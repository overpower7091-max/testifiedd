<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Reuse `src/components/page-skeletons.tsx` for route-specific loading placeholders so their geometry stays aligned with the dashboard and practice layouts.
- Keep installable app metadata manifest-only unless offline support is explicitly requested, avoiding cache-related preview issues.
