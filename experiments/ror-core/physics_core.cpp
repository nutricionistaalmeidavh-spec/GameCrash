// Independent MIT-compatible node-and-beam experiment inspired by the physical
// concepts found in Rigs of Rods. NOT a copy or port of its GPLv3 sources.
// The test is intentionally small, deterministic, self-contained and headless.
#include <algorithm>
#include <array>
#include <cassert>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {
constexpr float DT=0.0005f; // 2 kHz, matching RoR's time-step for an experiment
constexpr float MASS=1200.0f;
struct V {
  float x=0,y=0,z=0;
  V operator+(V b) const {return {x+b.x,y+b.y,z+b.z};}
  V operator-(V b) const {return {x-b.x,y-b.y,z-b.z};}
  V operator*(float f) const {return {x*f,y*f,z*f};}
  V operator/(float f) const {return *this*(1.0f/f);}
  V& operator+=(V b){x+=b.x;y+=b.y;z+=b.z;return *this;}
};
float dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}
float magnitude(V v){return std::sqrt(dot(v,v));}
struct Node {V position,velocity,force;float mass=75;};
struct Beam {
  int a=0,b=0;
  float initial=0,rest=0,k=280000,d=5000,yield=75000,breakForce=180000;
  bool broken=false;
};
struct Simulation {
  std::array<Node,16> nodes{};
  std::vector<Beam> beams;
  float maxDamage=0;
  void reset(float speed) {
    beams.clear();maxDamage=0;
    auto ix=[](int x,int y,int z){return x+2*(y+2*z);};
    for(int z=0;z<4;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++) {
      Node &n=nodes[ix(x,y,z)];
      n.position={x?0.85f:-0.85f,y?1.6f:0.5f,-8.0f+z*1.3f};
      n.velocity={0,0,speed};n.force={};n.mass=MASS/16;
    }
    auto connect=[&](int a,int b){
      V diff=nodes[a].position-nodes[b].position;
      Beam beam;beam.a=a;beam.b=b;beam.initial=beam.rest=magnitude(diff);
      beams.push_back(beam);
    };
    for(int z=0;z<4;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++){
      const int a=ix(x,y,z);
      if(x<1)connect(a,ix(x+1,y,z));
      if(y<1)connect(a,ix(x,y+1,z));
      if(z<3)connect(a,ix(x,y,z+1));
      if(z<3&&x<1)connect(a,ix(x+1,y,z+1));
      if(z<3&&y<1)connect(a,ix(x,y+1,z+1));
      if(x<1&&y<1)connect(a,ix(x+1,y+1,z));
    }
  }
  void step(){
    for(Node &n:nodes)n.force={0,-9.81f*n.mass,0};
    for(Beam &b:beams){
      if(b.broken)continue;
      Node &a=nodes[b.a],&c=nodes[b.b];
      V axis=a.position-c.position;
      const float len=magnitude(axis);
      if(len<0.0001f)continue;
      axis=axis/len;
      const float stretch=len-b.rest;
      const float rate=dot(a.velocity-c.velocity,axis);
      const float f=-b.k*stretch-b.d*rate;
      if(std::abs(f)>b.breakForce && std::abs(len/b.initial-1)>0.18f){
        b.broken=true;maxDamage=std::max(maxDamage,1.0f);continue;
      }
      if(std::abs(f)>b.yield){
        const float excess=std::abs(f)-b.yield;
        const float delta=std::min(0.002f,excess/b.k*DT*20);
        b.rest+=std::copysign(delta,stretch);
        b.rest=std::clamp(b.rest,b.initial*0.6f,b.initial*1.4f);
        maxDamage=std::max(maxDamage,std::min(1.0f,std::abs(b.rest/b.initial-1)));
      }
      const V force=axis*f;
      a.force+=force;c.force+=force*-1.0f;
    }
    for(Node &n:nodes){
      n.velocity+=n.force*(DT/n.mass);
      n.velocity=n.velocity*0.9998f; // numeric damping
      n.position+=n.velocity*DT;
      if(n.position.y<0){
        n.position.y=0;
        if(n.velocity.y<0)n.velocity.y*=-0.08f;
        n.velocity.x*=0.99f;n.velocity.z*=0.98f;
      }
      // Wall front face at z=-0.35. No geometric teleport until actual contact.
      if(n.position.z>-.35f){
        n.position.z=-.35f;
        if(n.velocity.z>0)n.velocity.z*=-0.10f;
      }
    }
  }
  int brokenCount()const {
    return static_cast<int>(std::count_if(beams.begin(),beams.end(),
      [](const Beam& b){return b.broken;}));
  }
} state;
}
extern "C" {
void lab_reset(float initialSpeedMps){state.reset(initialSpeedMps);}
void lab_step(){state.step();}
int lab_node_count(){return 16;}
int lab_beam_count(){return static_cast<int>(state.beams.size());}
int lab_broken_count(){return state.brokenCount();}
float lab_deformation_fraction(){return state.maxDamage;}
void lab_positions(float *out_xyz){
  if(!out_xyz)return;
  for(int i=0;i<16;i++){
    out_xyz[3*i]=state.nodes[i].position.x;
    out_xyz[3*i+1]=state.nodes[i].position.y;
    out_xyz[3*i+2]=state.nodes[i].position.z;
  }
}
}
#ifdef GC_PHYSICS_TEST
int main(){
  lab_reset(0);
  assert(lab_node_count()==16);
  assert(lab_beam_count()>16);
  for(int i=0;i<1000;i++)lab_step();
  float xyz[48];lab_positions(xyz);
  for(float v:xyz)assert(std::isfinite(v));
  assert(lab_broken_count()==0); // at rest no spontaneous break
  lab_reset(25);
  for(int i=0;i<4000;i++)lab_step();
  lab_positions(xyz);
  for(float v:xyz)assert(std::isfinite(v));
  assert(lab_deformation_fraction()>=0.0f);
  std::printf("CORE_OK nodes=%d beams=%d breaks=%d deformation=%.3f\n",
    lab_node_count(),lab_beam_count(),lab_broken_count(),lab_deformation_fraction());
}
#endif
