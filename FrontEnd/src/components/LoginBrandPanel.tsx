import heroSectionImg from "../assets/herosection.png";

interface LoginBrandPanelProps {
  title: string;
  description: string;
}

const LoginBrandPanel: React.FC<LoginBrandPanelProps> = ({ title, description }) => (
  <section className="relative isolate flex min-h-56 items-center justify-center overflow-hidden sm:min-h-64 lg:min-h-screen">
    <img
      src={heroSectionImg}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      className="absolute inset-0 size-full object-cover"
    />
    <div className="absolute inset-0 bg-black/50" />
    <div className="relative max-w-lg px-6 text-center text-white drop-shadow-sm sm:px-12">
      <h2 className="mb-2 font-serif text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto max-w-sm font-serif text-lg text-white/90 sm:text-xl">
        {description}
      </p>
    </div>
  </section>
);

export default LoginBrandPanel;